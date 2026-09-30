import type { Pool, PoolClient } from 'pg';

/**
 * Rotinas que rodam fora da tela (T10.1, T10.2): a retenção declarada no E5 e a
 * conferência de um banco restaurado, pedida pelo E6 §4. Sem 'server-only': são
 * chamadas pelos scripts de `scripts/`, que rodam fora do Next.
 */

type Db = Pick<Pool | PoolClient, 'query'>;

/** E5 §2.3: o registro de acesso fica 12 meses, e depois sai. */
export const RETENCAO_EVENTOS_LOGIN_MESES = 12;

export interface ResultadoRetencao {
  eventosLogin: number;
  sessoesVencidas: number;
}

/**
 * Apaga o registro de acesso vencido e a sessão expirada. A sessão expirada já
 * não autentica ninguém, e guardá-la seria guardar o endereço e o aparelho de
 * uma pessoa sem finalidade nenhuma. `agora` vem de fora para o teste fixar o dia.
 */
export async function aplicarRetencao(db: Db, agora: Date = new Date()): Promise<ResultadoRetencao> {
  const eventos = await db.query(
    `DELETE FROM eventos_login WHERE criado_em < $1::timestamptz - make_interval(months => $2)`,
    [agora, RETENCAO_EVENTOS_LOGIN_MESES],
  );
  const sessoes = await db.query('DELETE FROM sessoes WHERE expira_em < $1', [agora]);
  return { eventosLogin: eventos.rowCount ?? 0, sessoesVencidas: sessoes.rowCount ?? 0 };
}

/** E6 §4 passo 3: as entidades cuja contagem denuncia perda grosseira. */
export const ENTIDADES_CRITICAS = [
  'especies',
  'lotes',
  'movimentos_lote',
  'atribuicoes',
  'semanas',
  'pedidos',
  'pedidos_itens',
  'cadastro.pessoas',
  'usuarios',
] as const;

export interface LoteDivergente {
  codigo: string;
  saldo: number;
  somaMovimentos: number;
}

export interface Integridade {
  contagens: Record<(typeof ENTIDADES_CRITICAS)[number], number>;
  lotesAbertos: number;
  /** RN-21: lote cujo saldo não é a soma dos movimentos. Vazio é o esperado. */
  divergentes: LoteDivergente[];
}

/**
 * A conferência que valida uma restauração, e que serve também a qualquer dia
 * comum: a soma dos movimentos de cada lote tem de reproduzir o saldo (RN-21).
 * A contagem física de três canteiros (E6 §4 passo 4) continua sendo de gente.
 */
export async function conferirIntegridade(db: Db): Promise<Integridade> {
  const contagens = {} as Integridade['contagens'];
  for (const tabela of ENTIDADES_CRITICAS) {
    // Nome vem da constante acima, nunca de entrada
    const { rows } = await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${tabela}`);
    contagens[tabela] = rows[0].n;
  }

  const abertos = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM lotes WHERE encerrado_em IS NULL');
  const { rows: divergentes } = await db.query<LoteDivergente>(
    `SELECT l.codigo, l.quantidade_atual AS saldo, COALESCE(SUM(m.quantidade), 0)::int AS "somaMovimentos"
       FROM lotes l
       LEFT JOIN movimentos_lote m ON m.lote_id = l.id
      GROUP BY l.id, l.codigo, l.quantidade_atual
     HAVING l.quantidade_atual <> COALESCE(SUM(m.quantidade), 0)
      ORDER BY l.codigo`,
  );
  return { contagens, lotesAbertos: abertos.rows[0].n, divergentes };
}

/** O relatório que o script imprime, e que se cola no registro do teste de restauração (E6 §5). */
export function relatorioIntegridade(integridade: Integridade): string {
  const linhas = Object.entries(integridade.contagens).map(([tabela, n]) => `  ${tabela.padEnd(18)} ${n}`);
  linhas.push(`  ${'lotes abertos'.padEnd(18)} ${integridade.lotesAbertos}`);
  const saldo =
    integridade.divergentes.length === 0
      ? 'Saldo dos lotes: todos batem com a soma dos movimentos.'
      : [
          `ATENÇÃO: ${integridade.divergentes.length} lote(s) com saldo diferente da soma dos movimentos:`,
          ...integridade.divergentes.map((d) => `  ${d.codigo}: saldo ${d.saldo}, movimentos somam ${d.somaMovimentos}`),
        ].join('\n');
  return ['Contagens:', ...linhas, '', saldo].join('\n');
}
