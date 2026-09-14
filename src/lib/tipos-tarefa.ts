import { type Db, violatedConstraint } from './sql';

export type CategoriaTarefa = 'semente' | 'terra' | 'plantio' | 'manutencao' | 'pos_morte' | 'expedicao';

/** As seis categorias do CHECK `tipos_tarefa_categoria_valida`, na ordem do ciclo da muda (RN-23). */
export const CATEGORIA_TAREFA_LABELS: Record<CategoriaTarefa, string> = {
  semente: 'Semente',
  terra: 'Terra',
  plantio: 'Plantio',
  manutencao: 'Manutenção',
  pos_morte: 'Pós-morte',
  expedicao: 'Expedição',
};

export interface Declaracoes {
  eQuantitativa: boolean;
  exigeLote: boolean;
  exigeEspecie: boolean;
  exigeRecipiente: boolean;
}

export interface TipoTarefaFields extends Declaracoes {
  nome: string;
  categoria: CategoriaTarefa;
}

export interface TipoTarefa extends TipoTarefaFields {
  id: string;
  ativo: boolean;
}

export const DECLARACAO_LABELS: Record<keyof Declaracoes, string> = {
  eQuantitativa: 'Quantitativa por unidade',
  exigeLote: 'Exige lote específico',
  exigeEspecie: 'Exige espécie',
  exigeRecipiente: 'Exige recipiente',
};

/**
 * RF-21. O lote já determina a espécie: com lote exigido, pedir espécie seria
 * perguntar o que o sistema já sabe, e abrir espaço para as duas discordarem.
 */
export function parseTipoTarefaFields(input: {
  nome: string;
  categoria: string;
} & Declaracoes): { error: string } | { value: TipoTarefaFields } {
  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > 60) return { error: 'O nome da tarefa precisa ter de 2 a 60 caracteres.' };
  if (!(input.categoria in CATEGORIA_TAREFA_LABELS)) return { error: 'Escolha a categoria.' };
  return {
    value: {
      nome,
      categoria: input.categoria as CategoriaTarefa,
      eQuantitativa: input.eQuantitativa,
      exigeLote: input.exigeLote,
      exigeEspecie: input.exigeLote ? false : input.exigeEspecie,
      exigeRecipiente: input.exigeRecipiente,
    },
  };
}

/** Frase curta do que o formulário da agenda vai pedir. */
export function resumoDeclaracoes(tipo: Declaracoes): string {
  const pede = [
    tipo.exigeLote && 'lote',
    tipo.exigeEspecie && 'espécie',
    tipo.exigeRecipiente && 'recipiente',
    tipo.eQuantitativa && 'quantidade por pessoa',
  ].filter(Boolean);
  return pede.length ? `Pede ${pede.join(', ')}` : 'Não pede dado extra';
}

export function duplicateMessage(error: unknown): string | null {
  return violatedConstraint(error, '23505') === 'tipos_tarefa_nome_key' ? 'Já existe tipo de tarefa com esse nome.' : null;
}

const SELECT_TIPO = `
  SELECT id, nome, categoria, e_quantitativa AS "eQuantitativa", exige_lote AS "exigeLote",
         exige_especie AS "exigeEspecie", exige_recipiente AS "exigeRecipiente", ativo
    FROM tipos_tarefa`;

export async function listTiposTarefa(db: Db): Promise<TipoTarefa[]> {
  const { rows } = await db.query<TipoTarefa>(
    `${SELECT_TIPO}
      ORDER BY array_position(ARRAY['semente','terra','plantio','manutencao','pos_morte','expedicao'], categoria),
               ativo DESC, nome`,
  );
  return rows;
}

export async function findTipoTarefa(db: Db, id: string): Promise<TipoTarefa | null> {
  const { rows } = await db.query<TipoTarefa>(`${SELECT_TIPO} WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function insertTipoTarefa(db: Db, input: TipoTarefaFields): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tipos_tarefa (nome, categoria, e_quantitativa, exige_lote, exige_especie, exige_recipiente)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.nome, input.categoria, input.eQuantitativa, input.exigeLote, input.exigeEspecie, input.exigeRecipiente],
  );
  return rows[0].id;
}

/** Sem exclusão física: a agenda fechada continua apontando para o tipo fora de uso. */
export async function updateTipoTarefa(
  db: Db,
  id: string,
  changes: TipoTarefaFields & { ativo: boolean },
): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query(
    `UPDATE tipos_tarefa
        SET nome = $2, categoria = $3, e_quantitativa = $4, exige_lote = $5, exige_especie = $6,
            exige_recipiente = $7, ativo = $8
      WHERE id = $1`,
    [
      id,
      changes.nome,
      changes.categoria,
      changes.eQuantitativa,
      changes.exigeLote,
      changes.exigeEspecie,
      changes.exigeRecipiente,
      changes.ativo,
    ],
  );
  return rowCount ? 'ok' : 'nao_encontrado';
}
