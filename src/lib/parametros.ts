import type { Pool, PoolClient } from 'pg';

type Db = Pick<Pool, 'query'>;

export type TipoValor = 'texto' | 'numero' | 'booleano' | 'data';

export interface Parametro {
  chave: string;
  valor: string;
  tipoValor: TipoValor;
  descricao: string;
  atualizadoEm: Date;
  atualizadoPorNome: string | null;
}

interface ParametroInfo {
  label: string;
  unidade: string;
  dica: string;
  min: number;
  max: number;
}

export const ATENCAO = 'producao.atraso_atencao_dias';
export const CRITICO = 'producao.atraso_critico_dias';
export const MORTALIDADE = 'producao.mortalidade_limite_pct';

/** Como a tela chama cada chave (textos do F1 UC-06). Chave sem entrada aparece com a `descricao` do banco. */
export const PARAMETRO_INFO: Record<string, ParametroInfo> = {
  [MORTALIDADE]: {
    label: 'Limite de mortalidade',
    unidade: '%',
    dica: 'Acima disso o lote aparece destacado no mapa',
    min: 0,
    max: 100,
  },
  [ATENCAO]: {
    label: 'Atraso: atenção',
    unidade: 'dias',
    dica: 'A partir de quantos dias o lote fica amarelo',
    min: 0,
    max: 365,
  },
  [CRITICO]: {
    label: 'Atraso: crítico',
    unidade: 'dias',
    dica: 'A partir de quantos dias o lote fica vermelho',
    min: 0,
    max: 365,
  },
};

/** Ordem da tela: a do F1, e as chaves sem entrada no fim. */
export function sortParametros<T extends { chave: string }>(parametros: readonly T[]): T[] {
  const ordem = Object.keys(PARAMETRO_INFO);
  const posicao = (chave: string) => (ordem.includes(chave) ? ordem.indexOf(chave) : ordem.length);
  return [...parametros].sort((a, b) => posicao(a.chave) - posicao(b.chave) || a.chave.localeCompare(b.chave));
}

export function parametroLabel(parametro: { chave: string; descricao: string }): string {
  return PARAMETRO_INFO[parametro.chave]?.label ?? parametro.descricao;
}

/** Primeira camada: o valor tem de caber no `tipo_valor` da linha. Devolve o texto a gravar. */
export function validateValor(tipo: TipoValor, raw: string): { error: string } | { value: string } {
  const texto = raw.trim();
  switch (tipo) {
    case 'numero': {
      if (!/^-?\d+([.,]\d+)?$/.test(texto)) return { error: 'precisa ser um número' };
      return { value: texto.replace(',', '.') };
    }
    case 'booleano':
      return texto === 'true' || texto === 'false' ? { value: texto } : { error: 'precisa ser sim ou não' };
    case 'data': {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
      const data = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
      if (!data || data.toISOString().slice(0, 10) !== texto) return { error: 'precisa ser uma data válida' };
      return { value: texto };
    }
    case 'texto':
      if (texto === '' || texto.length > 500) return { error: 'precisa ter de 1 a 500 caracteres' };
      return { value: texto };
  }
}

/**
 * Valida o formulário inteiro contra as linhas existentes: toda chave do banco
 * precisa vir, e nenhuma chave de fora é aceita (ninguém cria parâmetro, D4 §3.7).
 */
export function validateParametros(
  existentes: readonly Pick<Parametro, 'chave' | 'tipoValor' | 'descricao'>[],
  valores: Readonly<Record<string, string>>,
): { error: string } | { value: Record<string, string> } {
  const conhecidas = new Set(existentes.map((p) => p.chave));
  if (Object.keys(valores).some((chave) => !conhecidas.has(chave))) {
    return { error: 'Parâmetro desconhecido. Não é possível criar parâmetro.' };
  }

  const value: Record<string, string> = {};
  for (const parametro of existentes) {
    const label = parametroLabel(parametro);
    const raw = valores[parametro.chave];
    if (raw === undefined) return { error: `Falta o valor de "${label}".` };
    const parsed = validateValor(parametro.tipoValor, raw);
    if ('error' in parsed) return { error: `"${label}" ${parsed.error}.` };

    // Segunda camada: o limite de cada chave que a tela conhece
    const info = PARAMETRO_INFO[parametro.chave];
    if (info) {
      const numero = Number(parsed.value);
      if (!Number.isInteger(numero) || numero < info.min || numero > info.max) {
        return { error: `"${label}" precisa ser um número inteiro de ${info.min} a ${info.max}.` };
      }
    }
    value[parametro.chave] = parsed.value;
  }

  // Crítico igual ou abaixo de atenção faria o amarelo sumir do mapa
  if (value[ATENCAO] !== undefined && value[CRITICO] !== undefined && Number(value[CRITICO]) <= Number(value[ATENCAO])) {
    return { error: 'O atraso crítico precisa ser maior que o atraso de atenção.' };
  }
  return { value };
}

export async function listParametros(db: Db): Promise<Parametro[]> {
  const { rows } = await db.query<Parametro>(
    `SELECT p.chave, p.valor, p.tipo_valor AS "tipoValor", p.descricao,
            p.atualizado_em AS "atualizadoEm", u.nome_exibicao AS "atualizadoPorNome"
       FROM parametros p
       LEFT JOIN usuarios u ON u.id = p.atualizado_por`,
  );
  return sortParametros(rows);
}

/**
 * Grava só o `valor` (e quem alterou), dentro da transação do chamador. Nunca
 * insere: chave que não existe devolve `desconhecido` e nada é gravado.
 */
export async function saveParametros(
  client: PoolClient,
  valores: Readonly<Record<string, string>>,
  usuarioId: string,
): Promise<'ok' | 'desconhecido'> {
  const chaves = Object.keys(valores);
  const { rows } = await client.query<{ chave: string }>(
    'SELECT chave FROM parametros WHERE chave = ANY($1::text[]) FOR UPDATE',
    [chaves],
  );
  if (rows.length !== chaves.length) return 'desconhecido';

  for (const chave of chaves) {
    await client.query(
      `UPDATE parametros SET valor = $2, atualizado_em = NOW(), atualizado_por = $3
        WHERE chave = $1 AND valor IS DISTINCT FROM $2`,
      [chave, valores[chave], usuarioId],
    );
  }
  return 'ok';
}
