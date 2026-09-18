import type { PoolClient } from 'pg';
import {
  type SituacaoAtribuicao,
  type SituacaoSemana,
  type UnidadeTarefa,
  SITUACOES_ATRIBUICAO,
  lerQuantidadeMedida,
} from './agenda-rotulos';
import { isDataIso, somaDias } from './datas';
import { UserError } from './errors';
import { type CausaPerda, isCausaPerda, lerQuantidade } from './lotes-rotulos';
import { nomeEspecieSql } from './lotes';
import { type ResultadoMovimento, registrarMovimento, travarLote } from './movimentos';
import { diasDaSemana, isInicioDeSemana, rotuloSemana } from './semanas';
import type { Db } from './sql';
import type { Declaracoes } from './tipos-tarefa';
import { parseHora } from './turnos';
import { isUuid } from './uuid';

export * from './agenda-rotulos';

/**
 * A agenda da semana (Fase 5, RF-26 a RF-31). Toda escrita trava primeiro a
 * linha da semana e só depois a atribuição: a mesma ordem em todo lugar é o que
 * impede o fechamento e a confirmação de se esperarem um ao outro para sempre.
 */

type Client = Pick<PoolClient, 'query'>;
type Resultado<T> = { error: string } | { value: T };

// ------------------------------------------------------------
// Validação, pura
// ------------------------------------------------------------

/** RN-12: sem hora, só início, ou início e fim. Fim sem início não é nenhum dos três (TA-28). */
export function parseHorario(inicio: string, fim: string): Resultado<{ inicio: string | null; fim: string | null }> {
  const textoInicio = inicio.trim();
  const textoFim = fim.trim();
  if (textoInicio === '' && textoFim !== '') {
    return { error: 'Hora de fim sem hora de início: informe o início, ou deixe as duas em branco.' };
  }
  if (textoInicio === '') return { value: { inicio: null, fim: null } };
  const minutosInicio = parseHora(textoInicio);
  const minutosFim = textoFim === '' ? null : parseHora(textoFim);
  if (minutosInicio === null || (textoFim !== '' && minutosFim === null)) return { error: 'Informe a hora no formato 07:00.' };
  if (minutosFim !== null && minutosFim <= minutosInicio) return { error: 'A hora de fim precisa ser depois da hora de início.' };
  return { value: { inicio: textoInicio.slice(0, 5), fim: minutosFim === null ? null : textoFim.slice(0, 5) } };
}

/** Como a mensagem de erro descreve o número que a unidade aceita. */
function formatoQuantidade(unidade: UnidadeTarefa): string {
  return unidade === 'un' ? 'um número inteiro' : 'um número com até duas casas (2,5)';
}

export interface AtribuicaoBruta {
  semana: string;
  dias: readonly string[];
  turnoId: string;
  horaInicio: string;
  horaFim: string;
  participantes: readonly string[];
  loteId: string;
  especieId: string;
  recipienteId: string;
  areaId: string;
  canteiroId: string;
  quantidadePlanejada: string;
  recorrente: boolean;
  observacoes: string;
  /** Etapa cuja sugestão originou a tarefa (RF-47). Vazio na tarefa lançada à mão. */
  loteEtapaId: string;
}

export interface AtribuicaoInput {
  semana: string;
  dias: string[];
  turnoId: string;
  tipoTarefaId: string;
  horaInicio: string | null;
  horaFim: string | null;
  participantes: string[];
  loteId: string | null;
  especieId: string | null;
  recipienteId: string | null;
  areaId: string | null;
  canteiroId: string | null;
  quantidadePlanejada: number | null;
  recorrente: boolean;
  observacoes: string | null;
  /**
   * Etapa de origem, quando a tarefa nasceu de uma sugestão (RF-47). O
   * vencimento **não** vem daqui: é lido no servidor, em `conferirReferencias`,
   * porque data postada no formulário apagaria o atraso que a coluna existe para
   * denunciar.
   */
  loteEtapaId: string | null;
}

/**
 * T5.2, RF-21, RF-26, RF-30. O tipo de tarefa comanda: o campo que ele não
 * declara é descartado, e não gravado. No planejamento o lote, a espécie e o
 * recipiente são opcionais (a semeadura se planeja antes de o lote existir); a
 * confirmação é que exige o lote.
 */
export function parseAtribuicao(
  tipo: Declaracoes & { id: string; unidadeMedida: UnidadeTarefa },
  bruta: AtribuicaoBruta,
): Resultado<AtribuicaoInput> {
  if (!isInicioDeSemana(bruta.semana)) return { error: 'Semana inválida.' };
  const participantes = [...new Set(bruta.participantes)];
  if (participantes.length === 0) return { error: 'Escolha ao menos uma pessoa.' };
  if (!participantes.every(isUuid)) return { error: 'Pessoa inválida.' };

  const dias = [...new Set(bruta.dias)].sort();
  if (dias.length === 0) return { error: 'Escolha ao menos um dia.' };
  const daSemana = diasDaSemana(bruta.semana);
  if (!dias.every((dia) => daSemana.includes(dia))) return { error: 'Escolha dias desta semana, de segunda a sábado.' };

  if (!isUuid(bruta.turnoId)) return { error: 'Escolha o turno. Toda tarefa tem turno, mesmo a que tem hora marcada.' };
  const horario = parseHorario(bruta.horaInicio, bruta.horaFim);
  if ('error' in horario) return horario;

  const escolhido = (declarado: boolean, valor: string) => (declarado && isUuid(valor) ? valor : null);
  // Área e canteiro só no tipo que os declara; o banco já recusa junto com lote (RN-24)
  const areaId = escolhido(tipo.exigeArea, bruta.areaId);
  const canteiroId = areaId ? escolhido(tipo.exigeArea, bruta.canteiroId) : null;

  let quantidadePlanejada: number | null = null;
  if (tipo.eQuantitativa && bruta.quantidadePlanejada.trim() !== '') {
    quantidadePlanejada = lerQuantidadeMedida(bruta.quantidadePlanejada, tipo.unidadeMedida);
    if (quantidadePlanejada === null || quantidadePlanejada <= 0) {
      return { error: `A quantidade prevista precisa ser ${formatoQuantidade(tipo.unidadeMedida)} maior que zero, ou ficar em branco.` };
    }
  }

  const observacoes = bruta.observacoes.trim();
  if (observacoes.length > 500) return { error: 'A observação pode ter até 500 caracteres.' };

  return {
    value: {
      semana: bruta.semana,
      dias,
      turnoId: bruta.turnoId,
      tipoTarefaId: tipo.id,
      horaInicio: horario.value.inicio,
      horaFim: horario.value.fim,
      participantes,
      loteId: escolhido(tipo.exigeLote, bruta.loteId),
      especieId: escolhido(tipo.exigeEspecie, bruta.especieId),
      recipienteId: escolhido(tipo.exigeRecipiente, bruta.recipienteId),
      areaId,
      canteiroId,
      quantidadePlanejada,
      recorrente: bruta.recorrente,
      observacoes: observacoes || null,
      loteEtapaId: isUuid(bruta.loteEtapaId) ? bruta.loteEtapaId : null,
    },
  };
}

export interface ReagendamentoBruto {
  data: string;
  turnoId: string;
  horaInicio: string;
  horaFim: string;
}

export interface ReagendamentoInput {
  data: string;
  turnoId: string;
  horaInicio: string | null;
  horaFim: string | null;
}

/**
 * O arrasto na agenda da semana (tela larga, RNF-14). Mexe só em quando a tarefa
 * acontece: dia, turno e hora. Tudo o mais continua no formulário, inclusive
 * quem faz, porque a tarefa é de um grupo e soltar a barra numa pessoa não diz
 * se ela substitui o grupo ou entra nele.
 */
export function parseReagendamento(bruto: ReagendamentoBruto): Resultado<ReagendamentoInput> {
  if (!isDataIso(bruto.data)) return { error: 'Dia inválido.' };
  if (!isUuid(bruto.turnoId)) return { error: 'Escolha o turno. Toda tarefa tem turno, mesmo a que tem hora marcada.' };
  const horario = parseHorario(bruto.horaInicio, bruto.horaFim);
  if ('error' in horario) return horario;
  return {
    value: { data: bruto.data, turnoId: bruto.turnoId, horaInicio: horario.value.inicio, horaFim: horario.value.fim },
  };
}

export interface ConfirmacaoBruta {
  loteId: string;
  areaId: string;
  canteiroId: string;
  /** Texto digitado por participante, pela id da pessoa. */
  quantidades: Readonly<Record<string, string>>;
  perdidas: string;
  causa: string;
}

export interface ConfirmacaoInput {
  loteId: string | null;
  areaId: string | null;
  canteiroId: string | null;
  quantidades: { pessoaId: string; quantidade: number | null }[];
  perda: { quantidade: number; causa: CausaPerda } | null;
}

/**
 * T5.5, RF-29, UC-20. O lote uma vez para a tarefa, exigido quando o tipo o
 * declara (FE-2); um número por participante só na tarefa quantitativa, e em
 * branco vale "sem contagem" (FA-4); um número inválido recusa a tarefa inteira
 * (FE-1). As mudas que morreram viram perda do lote (decisão de 14/09/2026).
 */
export function parseConfirmacao(
  tipo: Pick<Declaracoes, 'eQuantitativa' | 'exigeLote' | 'exigeArea'> & { unidadeMedida: UnidadeTarefa },
  participantes: readonly string[],
  bruta: ConfirmacaoBruta,
): Resultado<ConfirmacaoInput> {
  const loteId = tipo.exigeLote && isUuid(bruta.loteId) ? bruta.loteId : null;
  if (tipo.exigeLote && !loteId) return { error: 'Esta tarefa exige o lote: escolha em qual lote ela foi feita.' };
  const areaId = tipo.exigeArea && !tipo.exigeLote && isUuid(bruta.areaId) ? bruta.areaId : null;
  const canteiroId = areaId && isUuid(bruta.canteiroId) ? bruta.canteiroId : null;

  const quantidades: ConfirmacaoInput['quantidades'] = [];
  for (const pessoaId of participantes) {
    const texto = tipo.eQuantitativa ? (bruta.quantidades[pessoaId] ?? '').trim() : '';
    if (texto === '') {
      quantidades.push({ pessoaId, quantidade: null });
      continue;
    }
    const quantidade = lerQuantidadeMedida(texto, tipo.unidadeMedida);
    if (quantidade === null) {
      return { error: `Quantidade inválida: use ${formatoQuantidade(tipo.unidadeMedida)}, ou deixe em branco quem não foi contado.` };
    }
    quantidades.push({ pessoaId, quantidade });
  }

  let perda: ConfirmacaoInput['perda'] = null;
  const textoPerdidas = bruta.perdidas.trim();
  if (loteId && textoPerdidas !== '') {
    const perdidas = lerQuantidade(textoPerdidas);
    if (perdidas === null) return { error: 'As mudas que morreram precisam ser um número inteiro, ou ficar em branco.' };
    if (perdidas > 0) {
      if (!isCausaPerda(bruta.causa)) return { error: 'Escolha a causa das mudas que morreram.' };
      perda = { quantidade: perdidas, causa: bruta.causa };
    }
  }

  return { value: { loteId, areaId, canteiroId, quantidades, perda } };
}

// ------------------------------------------------------------
// Leitura
// ------------------------------------------------------------

export interface Semana {
  id: string;
  inicio: string;
  situacao: SituacaoSemana;
  fechadaEm: Date | null;
}

const SELECT_SEMANA = `
  SELECT id, to_char(inicio_semana, 'YYYY-MM-DD') AS inicio, situacao, fechada_em AS "fechadaEm"
    FROM semanas`;

export async function findSemana(db: Db, inicio: string): Promise<Semana | null> {
  const { rows } = await db.query<Semana>(`${SELECT_SEMANA} WHERE inicio_semana = $1`, [inicio]);
  return rows[0] ?? null;
}

export interface Funcionario {
  id: string;
  nome: string;
}

/** TA-10: funcionário é pessoa com o papel ativo, com ou sem usuário no sistema. */
export async function listFuncionarios(db: Db): Promise<Funcionario[]> {
  const { rows } = await db.query<Funcionario>(
    `SELECT pe.id, pe.nome
       FROM cadastro.pessoas pe
       JOIN cadastro.pessoas_papeis pp ON pp.pessoa_id = pe.id AND pp.papel = 'funcionario' AND pp.ativo
      WHERE pe.ativa
      ORDER BY pe.nome`,
  );
  return rows;
}

export interface Participante {
  id: string;
  nome: string;
  quantidade: number | null;
}

export interface AtribuicaoResumo {
  id: string;
  semanaId: string;
  semanaInicio: string;
  semanaSituacao: SituacaoSemana;
  data: string;
  turnoId: string;
  turno: string;
  horaInicio: string | null;
  horaFim: string | null;
  tipoTarefaId: string;
  tipo: string;
  eQuantitativa: boolean;
  exigeLote: boolean;
  exigeEspecie: boolean;
  exigeRecipiente: boolean;
  exigeArea: boolean;
  unidadeMedida: UnidadeTarefa;
  especieId: string | null;
  especie: string | null;
  recipienteId: string | null;
  recipiente: string | null;
  loteId: string | null;
  loteCodigo: string | null;
  areaId: string | null;
  area: string | null;
  canteiroId: string | null;
  canteiro: string | null;
  quantidadePlanejada: number | null;
  eRecorrente: boolean;
  situacao: SituacaoAtribuicao;
  observacoes: string | null;
  participantes: Participante[];
}

const SELECT_ATRIBUICAO = `
  SELECT a.id, s.id AS "semanaId", to_char(s.inicio_semana, 'YYYY-MM-DD') AS "semanaInicio", s.situacao AS "semanaSituacao",
         to_char(a.data_trabalho, 'YYYY-MM-DD') AS data, a.turno_id AS "turnoId", t.nome AS turno,
         to_char(a.hora_inicio, 'HH24:MI') AS "horaInicio", to_char(a.hora_fim, 'HH24:MI') AS "horaFim",
         a.tipo_tarefa_id AS "tipoTarefaId", tt.nome AS tipo, tt.e_quantitativa AS "eQuantitativa",
         tt.exige_lote AS "exigeLote", tt.exige_especie AS "exigeEspecie", tt.exige_recipiente AS "exigeRecipiente",
         tt.exige_area AS "exigeArea", tt.unidade_medida AS "unidadeMedida",
         a.especie_id AS "especieId", ${nomeEspecieSql('e')} AS especie,
         a.recipiente_id AS "recipienteId", r.nome AS recipiente,
         a.lote_id AS "loteId", l.codigo AS "loteCodigo",
         a.area_id AS "areaId", ar.letra AS area, a.canteiro_id AS "canteiroId", ac.letra || '-' || c.numero AS canteiro,
         a.quantidade_planejada::float8 AS "quantidadePlanejada", a.e_recorrente AS "eRecorrente", a.situacao, a.observacoes,
         COALESCE((SELECT json_agg(json_build_object('id', p.pessoa_id, 'nome', pe.nome, 'quantidade', p.quantidade_feita::float8)
                                   ORDER BY pe.nome)
                     FROM atribuicoes_participantes p
                     JOIN cadastro.pessoas pe ON pe.id = p.pessoa_id
                    WHERE p.atribuicao_id = a.id), '[]') AS participantes
    FROM atribuicoes a
    JOIN semanas s ON s.id = a.semana_id
    JOIN turnos_trabalho t ON t.id = a.turno_id
    JOIN tipos_tarefa tt ON tt.id = a.tipo_tarefa_id
    LEFT JOIN especies e ON e.id = a.especie_id
    LEFT JOIN recipientes r ON r.id = a.recipiente_id
    LEFT JOIN lotes l ON l.id = a.lote_id
    LEFT JOIN areas ar ON ar.id = a.area_id
    LEFT JOIN canteiros c ON c.id = a.canteiro_id
    LEFT JOIN areas ac ON ac.id = c.area_id`;

const ORDEM_NO_DIA = 't.inicio, a.hora_inicio NULLS LAST, tt.nome, a.criado_em';

export async function listAgendaSemana(db: Db, semanaId: string): Promise<AtribuicaoResumo[]> {
  const { rows } = await db.query<AtribuicaoResumo>(
    `${SELECT_ATRIBUICAO} WHERE a.semana_id = $1 ORDER BY a.data_trabalho, ${ORDEM_NO_DIA}`,
    [semanaId],
  );
  return rows;
}

export async function listAgendaDia(db: Db, data: string): Promise<AtribuicaoResumo[]> {
  const { rows } = await db.query<AtribuicaoResumo>(`${SELECT_ATRIBUICAO} WHERE a.data_trabalho = $1 ORDER BY ${ORDEM_NO_DIA}`, [
    data,
  ]);
  return rows;
}

export async function findAtribuicao(db: Db, id: string): Promise<AtribuicaoResumo | null> {
  const { rows } = await db.query<AtribuicaoResumo>(`${SELECT_ATRIBUICAO} WHERE a.id = $1`, [id]);
  return rows[0] ?? null;
}

export interface ResumoFechamento {
  confirmadas: number;
  /** Planejadas com gente escalada: o fechamento as assume como realizadas (RN-14). */
  semConfirmacao: number;
  /** Planejadas sem ninguém, como a ordem do protocolo: seguem pendentes. */
  semNinguem: number;
  naoConfirmadas: number;
}

export async function resumoFechamento(db: Db, semanaId: string): Promise<ResumoFechamento> {
  const { rows } = await db.query<ResumoFechamento>(
    `SELECT COUNT(*) FILTER (WHERE a.situacao = 'confirmada')::int AS confirmadas,
            COUNT(*) FILTER (WHERE a.situacao = 'planejada' AND tem.gente)::int AS "semConfirmacao",
            COUNT(*) FILTER (WHERE a.situacao = 'planejada' AND NOT tem.gente)::int AS "semNinguem",
            COUNT(*) FILTER (WHERE a.situacao = 'nao_confirmada')::int AS "naoConfirmadas"
       FROM atribuicoes a
      CROSS JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM atribuicoes_participantes p WHERE p.atribuicao_id = a.id) AS gente) tem
      WHERE a.semana_id = $1`,
    [semanaId],
  );
  return rows[0];
}

export interface LinhaGrade {
  /** `null` na linha das tarefas sem ninguém escalado. */
  pessoa: Funcionario | null;
  porDia: Record<string, AtribuicaoResumo[]>;
}

/**
 * T5.1: uma linha por pessoa, e a tarefa do grupo aparece na linha de cada um.
 * Funcionário inativo some da grade, mas não da semana em que trabalhou.
 */
export function montarGrade(funcionarios: readonly Funcionario[], atribuicoes: readonly AtribuicaoResumo[]): LinhaGrade[] {
  const linhas = new Map<string, LinhaGrade>(funcionarios.map((f) => [f.id, { pessoa: f, porDia: {} }]));
  const semNinguem: LinhaGrade = { pessoa: null, porDia: {} };
  const colocar = (linha: LinhaGrade, a: AtribuicaoResumo) => {
    linha.porDia[a.data] = [...(linha.porDia[a.data] ?? []), a];
  };

  for (const atribuicao of atribuicoes) {
    if (atribuicao.participantes.length === 0) colocar(semNinguem, atribuicao);
    for (const p of atribuicao.participantes) {
      if (!linhas.has(p.id)) linhas.set(p.id, { pessoa: { id: p.id, nome: p.nome }, porDia: {} });
      colocar(linhas.get(p.id)!, atribuicao);
    }
  }

  const grade = [...linhas.values()].sort((a, b) => a.pessoa!.nome.localeCompare(b.pessoa!.nome, 'pt-BR'));
  return Object.keys(semNinguem.porDia).length > 0 ? [...grade, semNinguem] : grade;
}

// ------------------------------------------------------------
// Escrita
// ------------------------------------------------------------

async function travarSemana(client: Client, coluna: 'id' | 'inicio_semana', valor: string): Promise<Semana> {
  const { rows } = await client.query<Semana>(`${SELECT_SEMANA} WHERE ${coluna} = $1 FOR UPDATE`, [valor]);
  if (!rows[0]) throw new UserError('Semana não encontrada.');
  return rows[0];
}

/** RF-28, RN-13: a trava no servidor. */
function recusarSeFechada(semana: Semana): void {
  if (semana.situacao === 'fechada') {
    throw new UserError(
      `A semana de ${rotuloSemana(semana.inicio)} está fechada e não se altera. Correção, só por lançamento na semana seguinte.`,
    );
  }
}

interface AtribuicaoTravada {
  id: string;
  situacao: SituacaoAtribuicao;
  loteId: string | null;
  exigeLote: boolean;
  semana: Semana;
}

/** A semana primeiro, depois a atribuição. */
async function travarAtribuicao(client: Client, id: string): Promise<AtribuicaoTravada> {
  const { rows } = await client.query<{ semanaId: string }>('SELECT semana_id AS "semanaId" FROM atribuicoes WHERE id = $1', [id]);
  if (!rows[0]) throw new UserError('Tarefa não encontrada.');
  const semana = await travarSemana(client, 'id', rows[0].semanaId);
  const { rows: travada } = await client.query<Omit<AtribuicaoTravada, 'semana'>>(
    `SELECT a.id, a.situacao, a.lote_id AS "loteId", tt.exige_lote AS "exigeLote"
       FROM atribuicoes a
       JOIN tipos_tarefa tt ON tt.id = a.tipo_tarefa_id
      WHERE a.id = $1
      FOR UPDATE OF a`,
    [id],
  );
  if (!travada[0]) throw new UserError('Tarefa não encontrada.');
  return { ...travada[0], semana };
}

function recusarSeNaoPlanejada(atribuicao: Pick<AtribuicaoTravada, 'situacao'>): void {
  if (atribuicao.situacao !== 'planejada') {
    throw new UserError(`Esta tarefa já está ${SITUACOES_ATRIBUICAO[atribuicao.situacao].toLowerCase()} e não se altera.`);
  }
}

interface DadosAtribuicao {
  data: string;
  turnoId: string;
  tipoTarefaId: string;
  horaInicio: string | null;
  horaFim: string | null;
  loteId: string | null;
  especieId: string | null;
  recipienteId: string | null;
  areaId: string | null;
  canteiroId: string | null;
  quantidadePlanejada: number | null;
  recorrente: boolean;
  observacoes: string | null;
  loteEtapaId?: string | null;
  /** Congelado no aceite: o atraso é do vencimento da etapa, e não do dia escolhido. */
  vencimentoProtocolo?: string | null;
}

async function inserirAtribuicao(client: Client, semanaId: string, dados: DadosAtribuicao, participantes: readonly string[]): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO atribuicoes (semana_id, data_trabalho, turno_id, tipo_tarefa_id, hora_inicio, hora_fim, lote_id, especie_id,
                              recipiente_id, area_id, canteiro_id, quantidade_planejada, e_recorrente, observacoes,
                              lote_etapa_id, vencimento_protocolo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id`,
    [
      semanaId,
      dados.data,
      dados.turnoId,
      dados.tipoTarefaId,
      dados.horaInicio,
      dados.horaFim,
      dados.loteId,
      dados.especieId,
      dados.recipienteId,
      dados.areaId,
      dados.canteiroId,
      dados.quantidadePlanejada,
      dados.recorrente,
      dados.observacoes,
      dados.loteEtapaId ?? null,
      dados.vencimentoProtocolo ?? null,
    ],
  );
  const id = rows[0].id;
  await client.query('INSERT INTO atribuicoes_participantes (atribuicao_id, pessoa_id) SELECT $1, unnest($2::uuid[])', [
    id,
    participantes,
  ]);
  return id;
}

/**
 * RF-47: o vencimento da etapa, lido **no servidor**. Nunca vem do formulário:
 * data postada apagaria o atraso que a coluna existe para denunciar. Confere de
 * passagem que a etapa é daquele lote, e devolve a data a congelar no aceite.
 */
async function vencimentoDaSugestao(client: Client, loteEtapaId: string, loteId: string | null): Promise<string> {
  if (!loteId) throw new UserError('A tarefa que nasce de uma sugestão precisa do lote que a originou.');
  const { rows } = await client.query<{ vencimento: string | null; existe: boolean }>(
    `SELECT to_char(v.proximo_vencimento, 'YYYY-MM-DD') AS vencimento,
            EXISTS (SELECT 1 FROM lotes_etapas le
                     WHERE le.lote_id = $2 AND le.protocolo_etapa_id = $1) AS existe
       FROM (SELECT 1) AS _
       LEFT JOIN lotes_etapas_vencimento v ON v.lote_id = $2 AND v.protocolo_etapa_id = $1`,
    [loteEtapaId, loteId],
  );
  const ref = rows[0];
  if (!ref?.existe) throw new UserError('Esta etapa não pertence ao lote escolhido.');
  if (!ref.vencimento) throw new UserError('Esta etapa não vence nada: a âncora dela ainda não ocorreu.');
  return ref.vencimento;
}

/** O que a validação pura não sabe: se o turno, o tipo, as pessoas e o lote existem e estão em uso. */
async function conferirReferencias(client: Client, input: AtribuicaoInput): Promise<void> {
  const { rows } = await client.query<{
    turno: boolean | null;
    tipo: boolean | null;
    pessoas: number;
    lote: boolean | null;
    areaDoCanteiro: string | null;
    area: boolean | null;
    especie: boolean | null;
    recipiente: boolean | null;
  }>(
    `SELECT (SELECT ativo FROM turnos_trabalho WHERE id = $1) AS turno,
            (SELECT ativo FROM tipos_tarefa WHERE id = $2) AS tipo,
            (SELECT COUNT(*)::int
               FROM cadastro.pessoas pe
               JOIN cadastro.pessoas_papeis pp ON pp.pessoa_id = pe.id AND pp.papel = 'funcionario' AND pp.ativo
              WHERE pe.ativa AND pe.id = ANY($3::uuid[])) AS pessoas,
            (SELECT encerrado_em IS NULL FROM lotes WHERE id = $4) AS lote,
            (SELECT area_id FROM canteiros WHERE id = $5) AS "areaDoCanteiro",
            (SELECT true FROM areas WHERE id = $6) AS area,
            (SELECT ativa FROM especies WHERE id = $7) AS especie,
            (SELECT ativo FROM recipientes WHERE id = $8) AS recipiente`,
    [
      input.turnoId,
      input.tipoTarefaId,
      input.participantes,
      input.loteId,
      input.canteiroId,
      input.areaId,
      input.especieId,
      input.recipienteId,
    ],
  );
  const ref = rows[0];
  if (ref.turno !== true) throw new UserError('Escolha um turno em uso.');
  if (ref.tipo !== true) throw new UserError('Escolha um tipo de tarefa em uso.');
  if (ref.pessoas !== input.participantes.length) throw new UserError('Alguma pessoa escolhida não é funcionário em atividade.');
  if (input.loteId && ref.lote !== true) throw new UserError('O lote escolhido não existe, ou já foi encerrado.');
  if (input.areaId && ref.area !== true) throw new UserError('Área não encontrada.');
  if (input.canteiroId && ref.areaDoCanteiro !== input.areaId) throw new UserError('O canteiro escolhido não é dessa área.');
  if (input.especieId && ref.especie !== true) throw new UserError('Escolha uma espécie em uso.');
  if (input.recipienteId && ref.recipiente !== true) throw new UserError('Escolha um recipiente em uso.');
}

/**
 * RF-27, RN-29: traz as atribuições da semana `origemInicio` para a semana
 * `destinoId`, sete dias depois. Volta planejada e sem contagem; só com quem
 * ainda é funcionário, e com o lote só se ele segue aberto. A tarefa que ficou
 * sem ninguém não é copiada.
 *
 * **A tarefa que nasceu de sugestão não é copiada** (`lote_etapa_id IS NULL`), e
 * a razão mudou com o RF-47: não é que o motor a gere sozinho, é que ela
 * pertence a um vencimento específico do lote. Copiá-la para a semana seguinte
 * carregaria um vencimento que não é o daquela semana. O protocolo torna a
 * sugeri-la enquanto a etapa continuar vencida.
 */
async function copiarDaSemana(client: Client, origemInicio: string, destinoId: string, recorrentes: boolean): Promise<number> {
  const { rows } = await client.query<DadosAtribuicao & { participantes: string[] }>(
    `SELECT to_char(a.data_trabalho + 7, 'YYYY-MM-DD') AS data, a.turno_id AS "turnoId", a.tipo_tarefa_id AS "tipoTarefaId",
            to_char(a.hora_inicio, 'HH24:MI') AS "horaInicio", to_char(a.hora_fim, 'HH24:MI') AS "horaFim",
            CASE WHEN l.encerrado_em IS NULL THEN a.lote_id END AS "loteId", a.especie_id AS "especieId",
            a.recipiente_id AS "recipienteId", a.area_id AS "areaId", a.canteiro_id AS "canteiroId",
            a.quantidade_planejada::float8 AS "quantidadePlanejada", a.e_recorrente AS recorrente, a.observacoes,
            ARRAY(SELECT p.pessoa_id::text
                    FROM atribuicoes_participantes p
                    JOIN cadastro.pessoas pe ON pe.id = p.pessoa_id AND pe.ativa
                    JOIN cadastro.pessoas_papeis pp ON pp.pessoa_id = p.pessoa_id AND pp.papel = 'funcionario' AND pp.ativo
                   WHERE p.atribuicao_id = a.id) AS participantes
       FROM atribuicoes a
       JOIN semanas s ON s.id = a.semana_id
       JOIN turnos_trabalho t ON t.id = a.turno_id AND t.ativo
       JOIN tipos_tarefa tt ON tt.id = a.tipo_tarefa_id AND tt.ativo
       LEFT JOIN lotes l ON l.id = a.lote_id
      WHERE s.inicio_semana = $1 AND a.e_recorrente = $2 AND a.lote_etapa_id IS NULL AND a.situacao <> 'cancelada'
      ORDER BY a.data_trabalho, t.inicio, a.criado_em`,
    [origemInicio, recorrentes],
  );
  let copiadas = 0;
  for (const { participantes, ...dados } of rows) {
    if (participantes.length === 0) continue;
    await inserirAtribuicao(client, destinoId, dados, participantes);
    copiadas++;
  }
  return copiadas;
}

/**
 * Cria a semana em rascunho, já com as tarefas recorrentes da anterior (RN-29).
 * Semana que já existe volta como está, sem copiar de novo.
 */
export async function abrirSemana(client: Client, inicio: string): Promise<{ id: string; criada: boolean; recorrentes: number }> {
  if (!isInicioDeSemana(inicio)) throw new UserError('Semana inválida.');
  const { rows } = await client.query<{ id: string }>(
    'INSERT INTO semanas (inicio_semana) VALUES ($1) ON CONFLICT (inicio_semana) DO NOTHING RETURNING id',
    [inicio],
  );
  if (rows.length === 0) {
    const existente = await travarSemana(client, 'inicio_semana', inicio);
    return { id: existente.id, criada: false, recorrentes: 0 };
  }
  const recorrentes = await copiarDaSemana(client, somaDias(inicio, -7), rows[0].id, true);
  return { id: rows[0].id, criada: true, recorrentes };
}

/**
 * T5.4, RF-27: o resto da semana passada, o que não é recorrente. Só em semana
 * sem outro lançamento: copiar duas vezes duplicaria a semana inteira.
 */
export async function copiarSemanaAnterior(client: Client, inicio: string): Promise<{ copiadas: number; recorrentes: number }> {
  const aberta = await abrirSemana(client, inicio);
  const semana = await travarSemana(client, 'id', aberta.id);
  recusarSeFechada(semana);
  const { rows } = await client.query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM atribuicoes WHERE semana_id = $1 AND NOT e_recorrente AND lote_etapa_id IS NULL',
    [semana.id],
  );
  if (rows[0].n > 0) {
    throw new UserError('Esta semana já tem tarefas lançadas além das recorrentes. A cópia só é feita em semana ainda vazia, para não duplicar.');
  }
  const copiadas = await copiarDaSemana(client, somaDias(inicio, -7), semana.id, false);
  if (copiadas === 0 && aberta.recorrentes === 0) throw new UserError('A semana passada não tem tarefa para copiar.');
  return { copiadas, recorrentes: aberta.recorrentes };
}

/** T5.3: rascunho vira publicada. */
export async function publicarSemana(client: Client, inicio: string, usuarioId: string): Promise<void> {
  const semana = await travarSemana(client, 'inicio_semana', inicio);
  recusarSeFechada(semana);
  if (semana.situacao === 'publicada') throw new UserError('A semana já está publicada.');
  await client.query("UPDATE semanas SET situacao = 'publicada', publicada_por = $2 WHERE id = $1", [semana.id, usuarioId]);
}

/**
 * T5.6, RF-31, RN-14: fecha a semana publicada. A planejada com gente escalada é
 * assumida como realizada, marcada de não confirmada; a sem ninguém fica pendente.
 */
export async function fecharSemana(client: Client, inicio: string): Promise<{ naoConfirmadas: number }> {
  const semana = await travarSemana(client, 'inicio_semana', inicio);
  if (semana.situacao === 'fechada') throw new UserError('A semana já está fechada.');
  if (semana.situacao === 'rascunho') throw new UserError('Publique a semana antes de fechá-la.');
  const { rowCount } = await client.query(
    `UPDATE atribuicoes a SET situacao = 'nao_confirmada'
      WHERE a.semana_id = $1 AND a.situacao = 'planejada'
        AND EXISTS (SELECT 1 FROM atribuicoes_participantes p WHERE p.atribuicao_id = a.id)`,
    [semana.id],
  );
  await client.query("UPDATE semanas SET situacao = 'fechada', fechada_em = NOW() WHERE id = $1", [semana.id]);
  return { naoConfirmadas: rowCount ?? 0 };
}

/** T5.1, T5.2: uma atribuição por dia escolhido, abrindo a semana se preciso. */
export async function criarAtribuicoes(client: Client, input: AtribuicaoInput): Promise<string[]> {
  const aberta = await abrirSemana(client, input.semana);
  const semana = await travarSemana(client, 'id', aberta.id);
  recusarSeFechada(semana);
  await conferirReferencias(client, input);

  // RF-47: a sugestão aceita congela o vencimento da etapa, lido do servidor
  const vencimentoProtocolo = input.loteEtapaId
    ? await vencimentoDaSugestao(client, input.loteEtapaId, input.loteId)
    : null;

  const ids: string[] = [];
  for (const data of input.dias) {
    ids.push(await inserirAtribuicao(client, semana.id, { ...input, data, vencimentoProtocolo }, input.participantes));
  }
  return ids;
}

/** Só a planejada, num dia só, e dentro da mesma semana. */
export async function atualizarAtribuicao(client: Client, id: string, input: AtribuicaoInput): Promise<void> {
  const atribuicao = await travarAtribuicao(client, id);
  recusarSeFechada(atribuicao.semana);
  recusarSeNaoPlanejada(atribuicao);
  if (input.dias.length !== 1 || atribuicao.semana.inicio !== input.semana) {
    throw new UserError('Escolha um dia da mesma semana. Para outra semana, lance a tarefa de novo.');
  }
  await conferirReferencias(client, input);
  await client.query(
    `UPDATE atribuicoes
        SET data_trabalho = $2, turno_id = $3, tipo_tarefa_id = $4, hora_inicio = $5, hora_fim = $6, lote_id = $7,
            especie_id = $8, recipiente_id = $9, area_id = $10, canteiro_id = $11, quantidade_planejada = $12,
            e_recorrente = $13, observacoes = $14
      WHERE id = $1`,
    [
      id,
      input.dias[0],
      input.turnoId,
      input.tipoTarefaId,
      input.horaInicio,
      input.horaFim,
      input.loteId,
      input.especieId,
      input.recipienteId,
      input.areaId,
      input.canteiroId,
      input.quantidadePlanejada,
      input.recorrente,
      input.observacoes,
    ],
  );
  await client.query('DELETE FROM atribuicoes_participantes WHERE atribuicao_id = $1', [id]);
  await client.query('INSERT INTO atribuicoes_participantes (atribuicao_id, pessoa_id) SELECT $1, unnest($2::uuid[])', [
    id,
    input.participantes,
  ]);
}

/**
 * Remarca a tarefa arrastada: dia, turno e hora, dentro da mesma semana. Só a
 * planejada, pelo mesmo motivo da alteração: o que já aconteceu não se remaneja.
 */
export async function reagendarAtribuicao(client: Client, id: string, input: ReagendamentoInput): Promise<{ semanaInicio: string }> {
  const atribuicao = await travarAtribuicao(client, id);
  recusarSeFechada(atribuicao.semana);
  recusarSeNaoPlanejada(atribuicao);
  if (!diasDaSemana(atribuicao.semana.inicio).includes(input.data)) {
    throw new UserError('Arraste para um dia desta semana, de segunda a sábado. Para outra semana, lance a tarefa de novo.');
  }
  const { rows } = await client.query<{ ativo: boolean }>('SELECT ativo FROM turnos_trabalho WHERE id = $1', [input.turnoId]);
  if (rows[0]?.ativo !== true) throw new UserError('Escolha um turno em uso.');

  await client.query('UPDATE atribuicoes SET data_trabalho = $2, turno_id = $3, hora_inicio = $4, hora_fim = $5 WHERE id = $1', [
    id,
    input.data,
    input.turnoId,
    input.horaInicio,
    input.horaFim,
  ]);
  return { semanaInicio: atribuicao.semana.inicio };
}

export async function excluirAtribuicao(client: Client, id: string): Promise<{ semanaInicio: string }> {
  const atribuicao = await travarAtribuicao(client, id);
  recusarSeFechada(atribuicao.semana);
  recusarSeNaoPlanejada(atribuicao);
  await client.query('DELETE FROM atribuicoes WHERE id = $1', [id]);
  return { semanaInicio: atribuicao.semana.inicio };
}

/**
 * T5.5, UC-20: marca confirmada para todos os participantes, cada um com a sua
 * quantidade, e grava a perda no lote pela porta única, ligada à tarefa.
 */
export async function confirmarAtribuicao(
  client: Client,
  id: string,
  input: ConfirmacaoInput,
  registradoPor: string,
): Promise<{ loteId: string | null; perda: ResultadoMovimento | null }> {
  const atribuicao = await travarAtribuicao(client, id);
  recusarSeFechada(atribuicao.semana);
  recusarSeNaoPlanejada(atribuicao);
  if (atribuicao.exigeLote && !input.loteId) throw new UserError('Esta tarefa exige o lote: escolha em qual lote ela foi feita.');

  const { rows: pessoas } = await client.query<{ id: string }>(
    'SELECT pessoa_id AS id FROM atribuicoes_participantes WHERE atribuicao_id = $1',
    [id],
  );
  if (pessoas.length === 0) throw new UserError('Escale ao menos uma pessoa antes de confirmar.');

  if (input.loteId) {
    const lote = await travarLote(client, input.loteId);
    if (!lote) throw new UserError('Lote não encontrado.');
    if (lote.encerrado) throw new UserError(`O lote ${lote.codigo} está encerrado.`);
  }
  if (input.canteiroId) {
    const { rows } = await client.query<{ areaId: string }>('SELECT area_id AS "areaId" FROM canteiros WHERE id = $1', [input.canteiroId]);
    if (rows[0]?.areaId !== input.areaId) throw new UserError('O canteiro escolhido não é dessa área.');
  }

  await client.query(
    "UPDATE atribuicoes SET lote_id = $2, area_id = $3, canteiro_id = $4, situacao = 'confirmada' WHERE id = $1",
    [id, input.loteId, input.areaId, input.canteiroId],
  );
  const quantidadeDe = new Map(input.quantidades.map((q) => [q.pessoaId, q.quantidade]));
  for (const pessoa of pessoas) {
    await client.query('UPDATE atribuicoes_participantes SET quantidade_feita = $3 WHERE atribuicao_id = $1 AND pessoa_id = $2', [
      id,
      pessoa.id,
      quantidadeDe.get(pessoa.id) ?? null,
    ]);
  }

  const perda =
    input.loteId && input.perda
      ? await registrarMovimento(client, {
          loteId: input.loteId,
          tipo: 'perda',
          quantidade: -input.perda.quantidade,
          causa: input.perda.causa,
          atribuicaoId: id,
          registradoPor,
        })
      : null;
  return { loteId: input.loteId, perda };
}

/** A repicagem que fecha a tarefa (UC-20 FA-1) só se liga à tarefa confirmada daquele lote. */
export async function conferirAtribuicaoDaRepicagem(client: Client, atribuicaoId: string, loteId: string): Promise<void> {
  const { rows } = await client.query<{ situacao: SituacaoAtribuicao; loteId: string | null }>(
    'SELECT situacao, lote_id AS "loteId" FROM atribuicoes WHERE id = $1',
    [atribuicaoId],
  );
  if (rows[0]?.situacao !== 'confirmada' || rows[0].loteId !== loteId) {
    throw new UserError('A tarefa informada não é deste lote, ou ainda não foi confirmada.');
  }
}
