import type { PoolClient } from 'pg';
import { type TipoImagem, deleteFoto, fotoIdFromUrl, fotoUrl, insertFoto } from './fotos';
import { type Db, escapeLike, violatedConstraint } from './sql';

/** Lista fechada do C8. Várias por espécie (RN-03): a mesma nativa é madeireira e ornamental. */
export const CARACTERISTICA_LABELS = {
  nativa: 'nativa',
  exotica: 'exótica',
  frutifera: 'frutífera',
  ornamental: 'ornamental',
  madeireira: 'madeireira',
  forrageira: 'forrageira',
} as const;

export type Caracteristica = keyof typeof CARACTERISTICA_LABELS;

export interface EspecieFields {
  nomeCientifico: string;
  /** O primeiro é o principal. */
  nomesPopulares: string[];
  caracteristicas: Caracteristica[];
  observacoes: string | null;
}

export interface Especie extends EspecieFields {
  id: string;
  fotoUrl: string | null;
  ativa: boolean;
}

const MAX_NOMES = 20;

/** Um nome por linha, ou separados por vírgula. Repetido (sem diferença de maiúscula) conta uma vez. */
export function splitNomes(text: string): string[] {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const parte of text.split(/[\n,;]/)) {
    const nome = parte.trim().replace(/\s+/g, ' ');
    const chave = nome.toLocaleLowerCase('pt-BR');
    if (nome && !vistos.has(chave)) {
      vistos.add(chave);
      nomes.push(nome);
    }
  }
  return nomes;
}

export function parseEspecieFields(input: {
  nomeCientifico: string;
  nomesPopulares: string;
  caracteristicas: readonly string[];
  observacoes: string;
}): { error: string } | { value: EspecieFields } {
  const nomeCientifico = input.nomeCientifico.trim().replace(/\s+/g, ' ');
  if (nomeCientifico.length < 3 || nomeCientifico.length > 120) {
    return { error: 'O nome científico precisa ter de 3 a 120 caracteres.' };
  }

  const nomesPopulares = splitNomes(input.nomesPopulares);
  if (nomesPopulares.length > MAX_NOMES) return { error: `Informe no máximo ${MAX_NOMES} nomes populares.` };
  if (nomesPopulares.some((nome) => nome.length > 60)) return { error: 'Cada nome popular pode ter até 60 caracteres.' };

  const caracteristicas = [...new Set(input.caracteristicas)];
  if (caracteristicas.some((c) => !(c in CARACTERISTICA_LABELS))) return { error: 'Característica desconhecida.' };

  const observacoes = input.observacoes.trim();
  if (observacoes.length > 1000) return { error: 'As observações podem ter até 1000 caracteres.' };

  return {
    value: {
      nomeCientifico,
      nomesPopulares,
      caracteristicas: caracteristicas as Caracteristica[],
      observacoes: observacoes || null,
    },
  };
}

/** Nome da tela: o popular principal, ou o científico quando não há popular. */
export function nomeExibido(especie: Pick<Especie, 'nomeCientifico' | 'nomesPopulares'>): string {
  return especie.nomesPopulares[0] ?? especie.nomeCientifico;
}

/** "ipe" acha "Ipê": no viveiro ninguém digita acento no celular. */
export function normalizeBusca(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucn';
const semAcento = (expr: string) => `translate(lower(${expr}), '${COM_ACENTO}', '${SEM_ACENTO}')`;

export function duplicateMessage(error: unknown): string | null {
  return violatedConstraint(error, '23505') === 'especies_nome_cientifico_key'
    ? 'Já existe espécie com esse nome científico.'
    : null;
}

const SELECT_ESPECIE = `
  SELECT e.id, e.nome_cientifico AS "nomeCientifico", e.caracteristicas, e.foto_url AS "fotoUrl",
         e.observacoes, e.ativa,
         COALESCE(array_agg(n.nome ORDER BY n.e_principal DESC, n.criado_em, n.nome)
                  FILTER (WHERE n.id IS NOT NULL), '{}') AS "nomesPopulares"
    FROM especies e
    LEFT JOIN especies_nomes_populares n ON n.especie_id = e.id`;

/** RF-10: acha pelo nome científico ou por qualquer nome popular. */
export async function searchEspecies(db: Db, busca = ''): Promise<Especie[]> {
  const termo = normalizeBusca(busca);
  const { rows } = await db.query<Especie>(
    `${SELECT_ESPECIE}
      WHERE $1 = ''
         OR ${semAcento('e.nome_cientifico')} LIKE '%' || $2 || '%'
         OR EXISTS (SELECT 1 FROM especies_nomes_populares b
                     WHERE b.especie_id = e.id AND ${semAcento('b.nome')} LIKE '%' || $2 || '%')
      GROUP BY e.id
      ORDER BY e.ativa DESC,
               lower(COALESCE(MAX(n.nome) FILTER (WHERE n.e_principal), e.nome_cientifico))
      LIMIT 300`,
    [termo, escapeLike(termo)],
  );
  return rows;
}

export async function findEspecie(db: Db, id: string): Promise<Especie | null> {
  const { rows } = await db.query<Especie>(`${SELECT_ESPECIE} WHERE e.id = $1 GROUP BY e.id`, [id]);
  return rows[0] ?? null;
}

export interface FotoChange {
  nova: { tipo: TipoImagem; conteudo: Buffer } | null;
  remover: boolean;
}

/**
 * Grava espécie, nomes e foto na transação do chamador. A foto substituída é
 * apagada junto, para `especies_fotos` não acumular imagem sem dono.
 */
export async function saveEspecie(
  client: PoolClient,
  id: string | null,
  fields: EspecieFields & { ativa: boolean },
  foto: FotoChange,
): Promise<{ resultado: 'ok'; id: string } | { resultado: 'nao_encontrado' }> {
  let fotoAtual: string | null = null;
  if (id) {
    const { rows } = await client.query<{ fotoUrl: string | null }>(
      'SELECT foto_url AS "fotoUrl" FROM especies WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (rows.length === 0) return { resultado: 'nao_encontrado' };
    fotoAtual = rows[0].fotoUrl;
  }

  let novaFotoUrl = foto.remover ? null : fotoAtual;
  if (foto.nova) novaFotoUrl = fotoUrl(await insertFoto(client, foto.nova));

  const params = [fields.nomeCientifico, fields.caracteristicas, novaFotoUrl, fields.observacoes, fields.ativa];
  let especieId: string;
  if (id) {
    await client.query(
      `UPDATE especies SET nome_cientifico = $1, caracteristicas = $2, foto_url = $3, observacoes = $4, ativa = $5
        WHERE id = $6`,
      [...params, id],
    );
    especieId = id;
  } else {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO especies (nome_cientifico, caracteristicas, foto_url, observacoes, ativa)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      params,
    );
    especieId = rows[0].id;
  }

  await client.query('DELETE FROM especies_nomes_populares WHERE especie_id = $1', [especieId]);
  if (fields.nomesPopulares.length > 0) {
    await client.query(
      `INSERT INTO especies_nomes_populares (especie_id, nome, e_principal)
       SELECT $1, t.nome, t.ordem = 1 FROM unnest($2::text[]) WITH ORDINALITY AS t(nome, ordem)`,
      [especieId, fields.nomesPopulares],
    );
  }

  const fotoAntigaId = fotoIdFromUrl(fotoAtual);
  if (fotoAntigaId && novaFotoUrl !== fotoAtual) await deleteFoto(client, fotoAntigaId);

  return { resultado: 'ok', id: especieId };
}
