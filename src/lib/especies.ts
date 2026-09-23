import type { PoolClient } from 'pg';
import { UserError } from './errors';
import { type NomeConhecido, achaConflitoDeNome } from './especies-nomes';
import type { EspecieRef } from './especies-form';
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

// ------------------------------------------------------------
// Cadastro rápido e aprendizado de nomes (T8.16)
// ------------------------------------------------------------

/** O nome de tela da espécie, direto no SQL: o popular principal, ou o científico. */
const nomeDaEspecieSql = `COALESCE(
  (SELECT p.nome FROM especies_nomes_populares p
    WHERE p.especie_id = e.id ORDER BY p.e_principal DESC, p.criado_em, p.nome LIMIT 1),
  e.nome_cientifico)`;

/**
 * Todos os nomes por onde uma espécie é chamada, populares e científico, com a
 * dona de cada um. É o que `achaConflitoDeNome` compara antes de gravar.
 */
export async function listNomesConhecidos(db: Db): Promise<NomeConhecido[]> {
  const { rows } = await db.query<NomeConhecido>(
    `SELECT n.especie_id AS "especieId", n.nome, ${nomeDaEspecieSql} AS especie
       FROM especies_nomes_populares n
       JOIN especies e ON e.id = n.especie_id
      UNION ALL
     SELECT e.id AS "especieId", e.nome_cientifico AS nome, ${nomeDaEspecieSql} AS especie
       FROM especies e`,
  );
  return rows;
}

async function lerEspecieRef(client: PoolClient, id: string): Promise<EspecieRef> {
  const especie = await findEspecie(client, id);
  if (!especie) throw new Error('Espécie recém-lida não encontrada.');
  return {
    id: especie.id,
    nome: nomeExibido(especie),
    nomeCientifico: especie.nomeCientifico,
    nomesPopulares: especie.nomesPopulares,
  };
}

/**
 * T8.16: a espécie que apareceu no meio de um pedido, cadastrada sem sair da
 * tela. Nasce ativa, com o científico e um nome popular, e o resto (foto,
 * características, protocolo) fica para o cadastro completo.
 *
 * **O científico é obrigatório porque a coluna é `NOT NULL UNIQUE`**, e é ela
 * que impede a mesma espécie de entrar duas vezes com nomes populares
 * diferentes. Quem cadastra pedido nem sempre o sabe, e por isso a alternativa
 * na tela é o item genérico, que deixa a espécie para a conferência.
 *
 * Nome já conhecido devolve a espécie existente, e não um erro: reaproveitar é
 * o que a pessoa queria, e duplicar catálogo é o estrago que se evita aqui.
 */
export async function criarEspecieRapida(
  client: PoolClient,
  input: { nomeCientifico: string; nomePopular: string },
): Promise<{ criada: EspecieRef } | { existente: EspecieRef }> {
  const parsed = parseEspecieFields({
    nomeCientifico: input.nomeCientifico,
    nomesPopulares: input.nomePopular,
    caracteristicas: [],
    observacoes: '',
  });
  if ('error' in parsed) throw new UserError(parsed.error);
  if (parsed.value.nomesPopulares.length === 0) throw new UserError('Informe o nome popular da espécie.');

  const conhecidos = await listNomesConhecidos(client);
  for (const candidato of [parsed.value.nomeCientifico, ...parsed.value.nomesPopulares]) {
    const conflito = achaConflitoDeNome(candidato, conhecidos);
    if (conflito) return { existente: await lerEspecieRef(client, conflito.especieId) };
  }

  const salva = await saveEspecie(client, null, { ...parsed.value, ativa: true }, { nova: null, remover: false });
  if (salva.resultado === 'nao_encontrado') throw new UserError('Não foi possível cadastrar a espécie.');
  return { criada: await lerEspecieRef(client, salva.id) };
}

/**
 * T8.16: o sistema aprende o nome que a pessoa corrigiu à mão. Da próxima vez
 * que o mesmo texto for colado, ele é reconhecido sozinho.
 *
 * RN-01: **um nome popular pertence a uma espécie só**, e o nome de outra é
 * recusado com o nome dela, para quem está cadastrando saber o que houve.
 */
export async function adicionarNomePopular(client: PoolClient, especieId: string, nome: string): Promise<string> {
  const limpo = nome.trim().replace(/\s+/g, ' ');
  if (!limpo) throw new UserError('Informe o nome a salvar.');
  if (limpo.length > 60) throw new UserError('Cada nome popular pode ter até 60 caracteres.');

  const conhecidos = await listNomesConhecidos(client);
  const conflito = achaConflitoDeNome(limpo, conhecidos, especieId);
  if (conflito) throw new UserError(`"${conflito.nome}" já é nome de ${conflito.especie}.`);

  try {
    await client.query(
      'INSERT INTO especies_nomes_populares (especie_id, nome) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [especieId, limpo],
    );
  } catch (error) {
    if (violatedConstraint(error, '23505')) throw new UserError('Esse nome já está cadastrado.');
    throw error;
  }
  return limpo;
}
