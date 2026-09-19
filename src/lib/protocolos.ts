import { somaDias } from './datas';
import { type Fase, FASES_EDITAVEIS } from './lotes-rotulos';
import {
  type SituacaoEtapa,
  type TipoAgendamento,
  type TipoAncora,
  isTipoAgendamento,
  isTipoAncora,
} from './protocolo-rotulos';
import { type Db, violatedConstraint } from './sql';

export interface Protocolo {
  id: string;
  recipienteId: string;
  recipiente: string;
  nome: string;
  ativo: boolean;
  observacoes: string | null;
  etapas: number;
}

export interface ProtocoloFields {
  recipienteId: string;
  nome: string;
  observacoes: string | null;
}

export interface Etapa {
  id: string;
  protocoloId: string;
  tipoTarefaId: string;
  tipoTarefa: string;
  rotulo: string;
  posicao: number;
  tipoAgendamento: TipoAgendamento;
  tipoAncora: TipoAncora;
  etapaAncoraId: string | null;
  etapaAncoraRotulo: string | null;
  dias: number;
  intervaloDias: number | null;
  turnoId: string;
  turno: string;
  alertaLigado: boolean;
  janelaAvisoPct: number | null;
  faseResultante: Fase | null;
  ativo: boolean;
}

export interface EtapaFields {
  tipoTarefaId: string;
  rotulo: string;
  tipoAgendamento: TipoAgendamento;
  tipoAncora: TipoAncora;
  etapaAncoraId: string | null;
  dias: number;
  intervaloDias: number | null;
  turnoId: string;
  alertaLigado: boolean;
  janelaAvisoPct: number | null;
  faseResultante: Fase | null;
}

// ------------------------------------------------------------
// Validação, pura
// ------------------------------------------------------------

export function parseProtocoloFields(input: {
  recipienteId: string;
  nome: string;
  observacoes: string;
}): { error: string } | { value: ProtocoloFields } {
  const nome = input.nome.trim();
  if (nome.length < 2 || nome.length > 60) return { error: 'O nome do protocolo precisa ter de 2 a 60 caracteres.' };
  const observacoes = input.observacoes.trim();
  if (observacoes.length > 500) return { error: 'A observação pode ter até 500 caracteres.' };
  return { value: { recipienteId: input.recipienteId, nome, observacoes: observacoes || null } };
}

/** Número inteiro de dias, dentro de um limite que cabe no ciclo de qualquer muda. */
function parseDias(texto: string, campo: string, min: number): { error: string } | { value: number } {
  const limpo = texto.trim();
  if (!/^\d{1,4}$/.test(limpo)) return { error: `${campo} precisa ser um número inteiro de dias.` };
  const dias = Number(limpo);
  if (dias < min) return { error: `${campo} precisa ser ${min === 0 ? 'zero ou mais' : 'maior que zero'}.` };
  if (dias > 3650) return { error: `${campo} passa de dez anos. Confira o valor.` };
  return { value: dias };
}

/**
 * RF-22 a RF-24. As recusas aqui são as do C2 UC-17: recorrente sem intervalo
 * (FE-2), âncora sem a etapa que a resolve, e fase resultante em etapa que
 * repete. O ciclo entre âncoras não cabe aqui, porque depende das outras etapas:
 * é `detectaCicloDeAncoras`.
 */
export function parseEtapaFields(input: {
  tipoTarefaId: string;
  rotulo: string;
  tipoAgendamento: string;
  tipoAncora: string;
  etapaAncoraId: string;
  dias: string;
  intervaloDias: string;
  turnoId: string;
  alertaLigado: boolean;
  janelaAvisoPct: string;
  faseResultante: string;
}): { error: string } | { value: EtapaFields } {
  const rotulo = input.rotulo.trim();
  if (rotulo.length < 2 || rotulo.length > 60) return { error: 'O rótulo da etapa precisa ter de 2 a 60 caracteres.' };
  if (!input.tipoTarefaId) return { error: 'Escolha a tarefa do catálogo.' };
  if (!input.turnoId) return { error: 'Escolha o turno da etapa.' };
  if (!isTipoAgendamento(input.tipoAgendamento)) return { error: 'Escolha se a etapa acontece uma vez ou repete.' };
  if (!isTipoAncora(input.tipoAncora)) return { error: 'Escolha a partir de quando a etapa conta.' };

  // RN-31: a âncora é campo, e a etapa que a resolve existe se e somente se o
  // tipo for a conclusão de outra etapa.
  const ancoraEmEtapa = input.tipoAncora === 'conclusao_de_etapa';
  if (ancoraEmEtapa && !input.etapaAncoraId) return { error: 'Escolha a etapa cuja conclusão inicia a contagem.' };

  const dias = parseDias(input.dias, 'O prazo', 0);
  if ('error' in dias) return dias;

  // RN-34 e C2 UC-17 FE-2: recorrente sem intervalo não produz a ocorrência
  // seguinte, e se apresentaria como se repetisse.
  const recorrente = input.tipoAgendamento === 'recorrente';
  let intervaloDias: number | null = null;
  if (recorrente) {
    const parsed = parseDias(input.intervaloDias, 'O intervalo entre as ocorrências', 1);
    if ('error' in parsed) return parsed;
    intervaloDias = parsed.value;
  }

  // RN-35: a janela é percentual do intervalo, e vazia usa a de Configurações.
  let janelaAvisoPct: number | null = null;
  const janela = input.janelaAvisoPct.trim();
  if (janela !== '') {
    if (!/^\d{1,3}([.,]\d{1,2})?$/.test(janela)) return { error: 'A janela de aviso é um percentual, como 20.' };
    janelaAvisoPct = Number(janela.replace(',', '.'));
    if (janelaAvisoPct > 100) return { error: 'A janela de aviso vai de 0 a 100 por cento.' };
  }

  // RN-34: só a sequencial avança a fase do lote.
  const fase = input.faseResultante.trim();
  if (fase !== '' && recorrente) {
    return { error: 'Etapa que repete não avança a fase do lote. Deixe a fase em branco.' };
  }
  if (fase !== '' && !FASES_EDITAVEIS.includes(fase as Exclude<Fase, 'encerrado'>)) {
    return { error: 'Escolha a fase na lista.' };
  }

  return {
    value: {
      tipoTarefaId: input.tipoTarefaId,
      rotulo,
      tipoAgendamento: input.tipoAgendamento,
      tipoAncora: input.tipoAncora,
      etapaAncoraId: ancoraEmEtapa ? input.etapaAncoraId : null,
      dias: dias.value,
      intervaloDias,
      turnoId: input.turnoId,
      alertaLigado: input.alertaLigado,
      janelaAvisoPct,
      faseResultante: fase === '' ? null : (fase as Fase),
    },
  };
}

/**
 * C2 UC-17 FE-1: o ciclo na cadeia de âncoras é representável no banco, e a
 * única barreira contra ele é esta função. Sem ela, duas etapas que se ancoram
 * mutuamente nunca ganhariam data de referência, e nenhuma das duas venceria
 * coisa alguma, **em silêncio**. Limite declarado no C8.
 *
 * Devolve o caminho do ciclo, do ponto de partida de volta a ele, ou nulo quando
 * a cadeia termina na criação do lote.
 */
export function detectaCicloDeAncoras(
  etapas: readonly { id: string; rotulo: string; etapaAncoraId: string | null }[],
  candidata: { id: string | null; rotulo: string; etapaAncoraId: string | null },
): string[] | null {
  const porId = new Map(etapas.filter((e) => e.id !== candidata.id).map((e) => [e.id, e]));
  const caminho = [candidata.rotulo];
  const vistos = new Set<string>(candidata.id ? [candidata.id] : []);

  let ancoraId = candidata.etapaAncoraId;
  while (ancoraId) {
    // A etapa aponta para si mesma, direta ou indiretamente
    if (vistos.has(ancoraId)) {
      const passo = porId.get(ancoraId);
      caminho.push(passo ? passo.rotulo : candidata.rotulo);
      return caminho;
    }
    vistos.add(ancoraId);
    const passo = porId.get(ancoraId);
    // Âncora que não existe na lista: a validação de referência é do banco
    if (!passo) return null;
    caminho.push(passo.rotulo);
    ancoraId = passo.etapaAncoraId;
  }
  return null;
}

/** Uma linha por etapa ativa dos protocolos vigentes, com o que a espécie sobrescreve (RF-25). */
export interface TempoDaEspecie {
  protocoloEtapaId: string;
  protocolo: string;
  recipiente: string;
  rotulo: string;
  tipoAgendamento: TipoAgendamento;
  /** O valor do protocolo, que vale quando a espécie não declara o dela. */
  diasPadrao: number;
  intervaloPadrao: number | null;
  /** O da espécie. Nulo usa o do protocolo (RN-36). */
  dias: number | null;
  intervaloDias: number | null;
  observacoes: string | null;
}

export interface TempoFields {
  dias: number | null;
  intervaloDias: number | null;
  observacoes: string | null;
}

/**
 * RF-25, UC-18. Vazio nos dois campos **não** é zero: é a remoção da
 * customização (FA-1). Zero seria etapa que vence no mesmo dia da âncora, que é
 * o oposto do que apagar significa, e linha sem nenhum override é ruído (FE-1).
 */
export function parseTempoFields(input: {
  dias: string;
  intervaloDias: string;
  observacoes: string;
}): { error: string } | { value: TempoFields | null } {
  const numero = (texto: string, campo: string): { error: string } | { value: number | null } => {
    const limpo = texto.trim();
    if (limpo === '') return { value: null };
    if (!/^\d{1,4}$/.test(limpo)) return { error: `${campo} precisa ser um número inteiro de dias.` };
    const valor = Number(limpo);
    if (valor <= 0) return { error: `${campo} precisa ser maior que zero. Para voltar ao padrão, deixe em branco.` };
    if (valor > 3650) return { error: `${campo} passa de dez anos. Confira o valor.` };
    return { value: valor };
  };

  const dias = numero(input.dias, 'O tempo da espécie');
  if ('error' in dias) return dias;
  const intervaloDias = numero(input.intervaloDias, 'O intervalo da espécie');
  if ('error' in intervaloDias) return intervaloDias;

  // Nenhum dos dois preenchido: a customização sai, em vez de virar linha vazia
  if (dias.value === null && intervaloDias.value === null) return { value: null };

  const observacoes = input.observacoes.trim();
  if (observacoes.length > 500) return { error: 'A observação pode ter até 500 caracteres.' };
  return { value: { dias: dias.value, intervaloDias: intervaloDias.value, observacoes: observacoes || null } };
}

export function duplicateMessage(error: unknown): string | null {
  switch (violatedConstraint(error, '23505')) {
    case 'protocolos_um_vigente_por_recipiente':
      return 'Este recipiente já tem um protocolo vigente. Edite o que existe, em vez de criar outro.';
    case 'protocolos_etapas_posicao_unica_no_protocolo':
      return 'Já existe etapa nessa posição do protocolo.';
    default:
      return null;
  }
}

// ------------------------------------------------------------
// Consulta e escrita
// ------------------------------------------------------------

export async function listProtocolos(db: Db): Promise<Protocolo[]> {
  const { rows } = await db.query<Protocolo>(
    `SELECT p.id, p.recipiente_id AS "recipienteId", r.nome AS recipiente, p.nome, p.ativo, p.observacoes,
            COUNT(e.id) FILTER (WHERE e.ativo)::int AS etapas
       FROM protocolos p
       JOIN recipientes r ON r.id = p.recipiente_id
       LEFT JOIN protocolos_etapas e ON e.protocolo_id = p.id
      GROUP BY p.id, r.nome, r.volume_litros
      ORDER BY p.ativo DESC, r.volume_litros NULLS LAST, r.nome`,
  );
  return rows;
}

export async function findProtocolo(db: Db, id: string): Promise<Protocolo | null> {
  const { rows } = await db.query<Protocolo>(
    `SELECT p.id, p.recipiente_id AS "recipienteId", r.nome AS recipiente, p.nome, p.ativo, p.observacoes,
            COUNT(e.id) FILTER (WHERE e.ativo)::int AS etapas
       FROM protocolos p
       JOIN recipientes r ON r.id = p.recipiente_id
       LEFT JOIN protocolos_etapas e ON e.protocolo_id = p.id
      WHERE p.id = $1
      GROUP BY p.id, r.nome`,
    [id],
  );
  return rows[0] ?? null;
}

/** As etapas na ordem de leitura, com o rótulo da âncora já resolvido (RF-23). */
export async function listEtapas(db: Db, protocoloId: string): Promise<Etapa[]> {
  const { rows } = await db.query<Etapa>(
    `SELECT e.id, e.protocolo_id AS "protocoloId", e.tipo_tarefa_id AS "tipoTarefaId", t.nome AS "tipoTarefa",
            e.rotulo, e.posicao, e.tipo_agendamento AS "tipoAgendamento", e.tipo_ancora AS "tipoAncora",
            e.etapa_ancora_id AS "etapaAncoraId", a.rotulo AS "etapaAncoraRotulo",
            e.dias, e.intervalo_dias AS "intervaloDias", e.turno_id AS "turnoId", n.nome AS turno,
            e.alerta_ligado AS "alertaLigado", e.janela_aviso_pct::float8 AS "janelaAvisoPct",
            e.fase_resultante AS "faseResultante", e.ativo
       FROM protocolos_etapas e
       JOIN tipos_tarefa t ON t.id = e.tipo_tarefa_id
       JOIN turnos_trabalho n ON n.id = e.turno_id
       LEFT JOIN protocolos_etapas a ON a.id = e.etapa_ancora_id
      WHERE e.protocolo_id = $1
      ORDER BY e.posicao`,
    [protocoloId],
  );
  return rows;
}

export async function insertProtocolo(db: Db, input: ProtocoloFields, criadoPor: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'INSERT INTO protocolos (recipiente_id, nome, observacoes, criado_por) VALUES ($1, $2, $3, $4) RETURNING id',
    [input.recipienteId, input.nome, input.observacoes, criadoPor],
  );
  return rows[0].id;
}

/**
 * Sem exclusão física: alterar o protocolo não retroage (RN-37), e o lote que já
 * o segue continua apontando para as etapas que cumpriu.
 */
export async function updateProtocolo(
  db: Db,
  id: string,
  changes: { nome: string; observacoes: string | null; ativo: boolean },
): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query('UPDATE protocolos SET nome = $2, observacoes = $3, ativo = $4 WHERE id = $1', [
    id,
    changes.nome,
    changes.observacoes,
    changes.ativo,
  ]);
  return rowCount ? 'ok' : 'nao_encontrado';
}

/** A etapa nova entra no fim da lista: a posição é de leitura, e não de dependência. */
export async function insertEtapa(db: Db, protocoloId: string, input: EtapaFields): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO protocolos_etapas
       (protocolo_id, tipo_tarefa_id, rotulo, posicao, tipo_agendamento, tipo_ancora, etapa_ancora_id,
        dias, intervalo_dias, turno_id, alerta_ligado, janela_aviso_pct, fase_resultante)
     VALUES ($1, $2, $3,
             (SELECT COALESCE(MAX(posicao), 0) + 1 FROM protocolos_etapas WHERE protocolo_id = $1),
             $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      protocoloId,
      input.tipoTarefaId,
      input.rotulo,
      input.tipoAgendamento,
      input.tipoAncora,
      input.etapaAncoraId,
      input.dias,
      input.intervaloDias,
      input.turnoId,
      input.alertaLigado,
      input.janelaAvisoPct,
      input.faseResultante,
    ],
  );
  return rows[0].id;
}

/**
 * UC-18 passo 2: as etapas dos protocolos vigentes, com o tempo padrão de cada
 * uma e o que esta espécie sobrescreve. A espécie sem customização nenhuma
 * devolve a lista inteira com `dias` e `intervaloDias` nulos.
 */
export async function listTemposDaEspecie(db: Db, especieId: string): Promise<TempoDaEspecie[]> {
  const { rows } = await db.query<TempoDaEspecie>(
    `SELECT e.id AS "protocoloEtapaId", p.nome AS protocolo, r.nome AS recipiente, e.rotulo,
            e.tipo_agendamento AS "tipoAgendamento", e.dias AS "diasPadrao",
            e.intervalo_dias AS "intervaloPadrao",
            t.dias, t.intervalo_dias AS "intervaloDias", t.observacoes
       FROM protocolos_etapas e
       JOIN protocolos p ON p.id = e.protocolo_id AND p.ativo
       JOIN recipientes r ON r.id = p.recipiente_id
       LEFT JOIN especies_protocolos_tempos t
         ON t.protocolo_etapa_id = e.id AND t.especie_id = $1
      WHERE e.ativo
      ORDER BY r.volume_litros NULLS LAST, r.nome, e.posicao`,
    [especieId],
  );
  return rows;
}

/**
 * RF-25. Grava só o que foi preenchido, e **apaga a linha** quando os dois
 * valores saem (FA-1): o que ficou em branco volta a vir do protocolo (RN-36).
 */
export async function saveTempoDaEspecie(
  db: Db,
  especieId: string,
  protocoloEtapaId: string,
  changes: TempoFields | null,
): Promise<'gravado' | 'removido'> {
  if (changes === null) {
    await db.query('DELETE FROM especies_protocolos_tempos WHERE especie_id = $1 AND protocolo_etapa_id = $2', [
      especieId,
      protocoloEtapaId,
    ]);
    return 'removido';
  }

  await db.query(
    `INSERT INTO especies_protocolos_tempos (especie_id, protocolo_etapa_id, dias, intervalo_dias, observacoes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (especie_id, protocolo_etapa_id)
     DO UPDATE SET dias = EXCLUDED.dias, intervalo_dias = EXCLUDED.intervalo_dias,
                   observacoes = EXCLUDED.observacoes`,
    [especieId, protocoloEtapaId, changes.dias, changes.intervaloDias, changes.observacoes],
  );
  return 'gravado';
}

/**
 * RF-46, UC-22 passo 8: o lote recebe, ao nascer, o protocolo vigente do
 * recipiente dele, e uma linha de acompanhamento por etapa ativa.
 *
 * **A âncora que já ocorreu é resolvida aqui**, e a que não ocorreu fica nula:
 * as etapas que contam da criação do lote vencem a partir de `dataCriacao`, e as
 * que contam da conclusão de outra etapa não vencem nada até ela ser concluída
 * (RN-31). Nulo é informação, e não dado faltando.
 *
 * Recipiente sem protocolo vigente não é erro: o lote é criado e não cobra etapa
 * nenhuma (UC-22 FA-2). Devolve o id do protocolo aplicado, ou nulo.
 *
 * Roda na transação de quem cria o lote: sem ela, o lote existiria sem
 * acompanhamento se a segunda escrita falhasse.
 */
export async function materializarProtocolo(
  client: Db,
  loteId: string,
  recipienteId: string,
  dataCriacao: string,
): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    'SELECT id FROM protocolos WHERE recipiente_id = $1 AND ativo',
    [recipienteId],
  );
  const protocoloId = rows[0]?.id ?? null;
  if (!protocoloId) return null;

  await client.query('UPDATE lotes SET protocolo_id = $2 WHERE id = $1', [loteId, protocoloId]);

  // Uma linha por etapa ativa, com a âncora de criação já resolvida
  await client.query(
    `INSERT INTO lotes_etapas (lote_id, protocolo_etapa_id, data_ancora)
     SELECT $1, e.id,
            CASE WHEN e.tipo_ancora = 'criacao_do_lote' THEN $3::date ELSE NULL END
       FROM protocolos_etapas e
      WHERE e.protocolo_id = $2 AND e.ativo`,
    [loteId, protocoloId, dataCriacao],
  );
  return protocoloId;
}

/** Uma etapa do protocolo no percurso deste lote (RF-51). */
export interface EtapaDoLote {
  protocoloEtapaId: string;
  rotulo: string;
  tipoTarefa: string;
  posicao: number;
  tipoAgendamento: TipoAgendamento;
  ultimaExecucaoEm: string | null;
  ocorrencias: number;
  concluida: boolean;
  /** Nulo quando a âncora ainda não ocorreu, ou a sequencial já se encerrou. */
  proximoVencimento: string | null;
  /** Nula junto com o vencimento; `sem_alerta` na etapa que não avisa (RN-35). */
  situacao: SituacaoEtapa | null;
  diasAtraso: number;
}

/**
 * RF-51, RF-52, TA-43: as etapas do lote com a data da última execução, o
 * próximo vencimento e a situação de cada uma.
 *
 * Lê de `lotes_etapas`, e não da visão: a visão devolve só o que ainda vence
 * algo, e a ficha precisa mostrar também **a concluída** e **a que não vence
 * nada** porque a âncora não ocorreu. As três aparecem, cada uma com o seu
 * estado, e é isso que o TA-43 confere.
 */
export async function listEtapasDoLote(db: Db, loteId: string, hoje: string): Promise<EtapaDoLote[]> {
  const { rows } = await db.query<EtapaDoLote>(
    `SELECT le.protocolo_etapa_id AS "protocoloEtapaId", pe.rotulo, t.nome AS "tipoTarefa", pe.posicao,
            pe.tipo_agendamento AS "tipoAgendamento",
            to_char(le.ultima_execucao_em, 'YYYY-MM-DD') AS "ultimaExecucaoEm",
            le.ocorrencias, le.concluido_em IS NOT NULL AS concluida,
            to_char(v.proximo_vencimento, 'YYYY-MM-DD') AS "proximoVencimento",
            v.situacao,
            GREATEST(0, $2::date - v.proximo_vencimento)::int AS "diasAtraso"
       FROM lotes_etapas le
       JOIN protocolos_etapas pe ON pe.id = le.protocolo_etapa_id
       JOIN tipos_tarefa t ON t.id = pe.tipo_tarefa_id
       LEFT JOIN lotes_etapas_vencimento v
         ON v.lote_id = le.lote_id AND v.protocolo_etapa_id = le.protocolo_etapa_id
      WHERE le.lote_id = $1
      ORDER BY pe.posicao`,
    [loteId, hoje],
  );
  return rows.map((etapa) => ({ ...etapa, diasAtraso: etapa.diasAtraso ?? 0 }));
}

/** Uma etapa que o protocolo aponta, e que ninguém lançou ainda (RF-47). */
export interface Sugestao {
  loteEtapaId: string;
  loteId: string;
  loteCodigo: string;
  especie: string;
  canteiro: string | null;
  rotulo: string;
  tipoTarefaId: string;
  tipoTarefa: string;
  turnoId: string;
  vencimento: string;
  situacao: SituacaoEtapa;
  diasAtraso: number;
}

/**
 * RF-47: o que o protocolo **sugere**, e nada mais. Esta função não escreve: a
 * tarefa só existe quando a gerência aceita a sugestão e a preenche por inteiro,
 * participantes inclusive (RN-41).
 *
 * O horizonte é parâmetro, e não constante: sugerir um ano de limpezas
 * trimestrais encheria a lista de avisos que ninguém olha por nove meses. O que
 * vence depois dele aparece na ficha do lote, e não aqui.
 *
 * A etapa que já tem tarefa lançada e não cancelada **sai da lista**: aceita uma
 * vez, deixa de ser sugerida (TA-39). A cancelada volta a sugerir, porque
 * cancelar é o que permite lançar de novo.
 */
export async function listSugestoes(db: Db, hoje: string, horizonteDias: number): Promise<Sugestao[]> {
  const { rows } = await db.query<Sugestao>(
    `SELECT le.protocolo_etapa_id AS "loteEtapaId", v.lote_id AS "loteId", l.codigo AS "loteCodigo",
            COALESCE(MAX(np.nome) FILTER (WHERE np.e_principal), e.nome_cientifico) AS especie,
            CASE WHEN c.id IS NULL THEN NULL ELSE a.letra || '-' || c.numero END AS canteiro,
            pe.rotulo, pe.tipo_tarefa_id AS "tipoTarefaId", tt.nome AS "tipoTarefa",
            pe.turno_id AS "turnoId",
            to_char(v.proximo_vencimento, 'YYYY-MM-DD') AS vencimento,
            v.situacao,
            GREATEST(0, $1::date - v.proximo_vencimento)::int AS "diasAtraso"
       FROM lotes_etapas_vencimento v
       JOIN lotes_etapas le ON le.lote_id = v.lote_id AND le.protocolo_etapa_id = v.protocolo_etapa_id
       JOIN lotes l ON l.id = v.lote_id
       JOIN especies e ON e.id = l.especie_id
       LEFT JOIN especies_nomes_populares np ON np.especie_id = e.id
       JOIN protocolos_etapas pe ON pe.id = v.protocolo_etapa_id
       JOIN tipos_tarefa tt ON tt.id = pe.tipo_tarefa_id AND tt.ativo
       LEFT JOIN canteiros c ON c.id = l.canteiro_id
       LEFT JOIN areas a ON a.id = c.area_id
      WHERE v.proximo_vencimento <= $1::date + $2::int
        AND NOT EXISTS (
          SELECT 1 FROM atribuicoes at
           WHERE at.lote_etapa_id = v.protocolo_etapa_id
             AND at.lote_id = v.lote_id
             AND at.vencimento_protocolo = v.proximo_vencimento
             AND at.situacao <> 'cancelada')
      GROUP BY le.protocolo_etapa_id, v.lote_id, l.codigo, e.nome_cientifico, c.id, a.letra, c.numero,
               pe.rotulo, pe.tipo_tarefa_id, tt.nome, pe.turno_id, v.proximo_vencimento, v.situacao
      ORDER BY v.proximo_vencimento, l.codigo`,
    [hoje, horizonteDias],
  );
  return rows;
}

/**
 * A agenda mostra uma semana por vez, e a sugestão que vence em outra semana não
 * é assunto dela. O atrasado continua aparecendo enquanto a semana aberta é a de
 * hoje: é nela que ainda dá para fazer.
 */
export function sugestoesDaSemana<T extends { vencimento: string }>(
  sugestoes: readonly T[],
  inicio: string,
  hoje: string,
): T[] {
  const fim = somaDias(inicio, 6);
  const semanaDeHoje = hoje >= inicio && hoje <= fim;
  return sugestoes.filter((s) => s.vencimento <= fim && (s.vencimento >= inicio || semanaDeHoje));
}

/**
 * RF-48, RF-49: a etapa concluída. Grava a **data real** da execução, e é dela
 * que a ocorrência seguinte conta (RN-32); nunca da data planejada, que
 * devolveria o comportamento de calendário fixo que o módulo existe para não
 * ter.
 *
 * A sequencial se encerra de vez e **avança a fase do lote** quando declara fase
 * resultante; a recorrente nunca avança fase nenhuma (RN-34). Concluída a etapa,
 * as que ancoravam nela ganham a âncora e passam a vencer (RN-31).
 *
 * Roda na transação de quem confirma a tarefa.
 */
export async function concluirEtapa(
  client: Db,
  loteId: string,
  protocoloEtapaId: string,
  dataExecucao: string,
): Promise<{ faseAvancada: string | null }> {
  const { rows } = await client.query<{
    tipoAgendamento: TipoAgendamento;
    faseResultante: string | null;
    categoria: string;
  }>(
    `SELECT e.tipo_agendamento AS "tipoAgendamento", e.fase_resultante AS "faseResultante", t.categoria
       FROM protocolos_etapas e
       JOIN tipos_tarefa t ON t.id = e.tipo_tarefa_id
      WHERE e.id = $1`,
    [protocoloEtapaId],
  );
  const etapa = rows[0];
  if (!etapa) return { faseAvancada: null };
  const sequencial = etapa.tipoAgendamento === 'sequencial';

  // O fato: quando foi feita, e quantas vezes já foi. A sequencial sai da visão
  // de vencimentos ao encerrar; a recorrente segue, contando dali.
  const { rowCount } = await client.query(
    `UPDATE lotes_etapas
        SET ultima_execucao_em = $3, ocorrencias = ocorrencias + 1,
            concluido_em = CASE WHEN $4 THEN NOW() ELSE concluido_em END
      WHERE lote_id = $1 AND protocolo_etapa_id = $2`,
    [loteId, protocoloEtapaId, dataExecucao, sequencial],
  );
  if (!rowCount) return { faseAvancada: null };

  // RN-34: só a sequencial promove o lote, e só quando declara para onde
  let faseAvancada: string | null = null;
  if (sequencial && etapa.faseResultante) {
    const { rowCount: mudou } = await client.query(
      'UPDATE lotes SET fase = $2 WHERE id = $1 AND encerrado_em IS NULL',
      [loteId, etapa.faseResultante],
    );
    if (mudou) faseAvancada = etapa.faseResultante;
  }

  /**
   * A data real do plantio do lote. Nada marca uma etapa como "a do plantio", e
   * a categoria do tipo de tarefa é o sinal que já existe e não precisa de
   * coluna nova. Só preenche enquanto estiver vazia: vazio significa "ainda não
   * germinou", e a primeira conclusão é que o encerra.
   */
  if (etapa.categoria === 'plantio') {
    await client.query('UPDATE lotes SET data_plantio = $2 WHERE id = $1 AND data_plantio IS NULL', [
      loteId,
      dataExecucao,
    ]);
  }

  // RN-31: as etapas que esperavam esta conclusão ganham a âncora e passam a vencer
  await client.query(
    `UPDATE lotes_etapas
        SET data_ancora = $3
      WHERE lote_id = $1
        AND data_ancora IS NULL
        AND protocolo_etapa_id IN (SELECT id FROM protocolos_etapas WHERE etapa_ancora_id = $2)`,
    [loteId, protocoloEtapaId, dataExecucao],
  );

  return { faseAvancada };
}

/**
 * RF-40, RN-39, TA-46: o acompanhamento do original copiado para o resultante da
 * divisão. Cada resultante **continua de onde o original estava**, e a partir
 * daí os dois seguem independentes.
 *
 * Sobrescreve o que `materializarProtocolo` acabou de montar: o lote novo nasceu
 * com as âncoras contadas da criação dele, e é exatamente isso que a divisão não
 * pode deixar valer. Recomeçar mandaria classificar de novo muda já
 * classificada, e a limpeza vencida em dezembro renasceria vencendo em março.
 *
 * Copia só as etapas que o resultante também tem: o recipiente é o mesmo, então
 * é o protocolo inteiro, mas a interseção é explícita para que uma etapa
 * desativada entre a criação do original e a divisão não ressuscite.
 *
 * Roda na transação da divisão.
 */
export async function herdarProtocolo(client: Db, origemId: string, destinoId: string): Promise<number> {
  const { rowCount } = await client.query(
    `UPDATE lotes_etapas destino
        SET data_ancora = origem.data_ancora,
            ultima_execucao_em = origem.ultima_execucao_em,
            ocorrencias = origem.ocorrencias,
            concluido_em = origem.concluido_em,
            herdado_do_lote_id = $1
       FROM lotes_etapas origem
      WHERE origem.lote_id = $1
        AND destino.lote_id = $2
        AND destino.protocolo_etapa_id = origem.protocolo_etapa_id`,
    [origemId, destinoId],
  );
  return rowCount ?? 0;
}

/**
 * RF-53, RN-38: o protocolo do lote encerrado. Lote encerrado deixa de vencer
 * etapa (a visão `lotes_etapas_vencimento` já o exclui pelo `encerrado_em`, e é
 * por isso que não há nada a apagar em `lotes_etapas`), mas as tarefas que a
 * gerência já lançou continuam na grade da semana, cobrando trabalho num lote
 * que não existe mais. São elas que esta função cancela.
 *
 * **Cancela, e não apaga** (RF-53): a tarefa cancelada continua consultável, e o
 * índice `atribuicoes_uma_ordem_por_vencimento` a ignora, de modo que o lote
 * dividido pode relançar a mesma etapa nos resultantes.
 *
 * **Só a `planejada`.** A `confirmada` é trabalho que aconteceu, e a
 * `nao_confirmada` é o que o fechamento da semana já assumiu como realizado
 * (RN-14): cancelar qualquer uma das duas reescreveria o passado de uma semana
 * fechada. "Ainda não confirmada" do RF-53 é a que segue pendente.
 *
 * Roda na transação de quem encerra o lote, que é sempre a porta única de
 * `movimentos.ts`. Devolve quantas ordens foram canceladas.
 */
export async function encerrarProtocoloDoLote(client: Db, loteId: string): Promise<number> {
  const { rowCount } = await client.query(
    `UPDATE atribuicoes
        SET situacao = 'cancelada'
      WHERE lote_id = $1
        AND lote_etapa_id IS NOT NULL
        AND situacao = 'planejada'`,
    [loteId],
  );
  return rowCount ?? 0;
}

export async function updateEtapa(
  db: Db,
  id: string,
  changes: EtapaFields & { ativo: boolean },
): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query(
    `UPDATE protocolos_etapas
        SET tipo_tarefa_id = $2, rotulo = $3, tipo_agendamento = $4, tipo_ancora = $5, etapa_ancora_id = $6,
            dias = $7, intervalo_dias = $8, turno_id = $9, alerta_ligado = $10, janela_aviso_pct = $11,
            fase_resultante = $12, ativo = $13
      WHERE id = $1`,
    [
      id,
      changes.tipoTarefaId,
      changes.rotulo,
      changes.tipoAgendamento,
      changes.tipoAncora,
      changes.etapaAncoraId,
      changes.dias,
      changes.intervaloDias,
      changes.turnoId,
      changes.alertaLigado,
      changes.janelaAvisoPct,
      changes.faseResultante,
      changes.ativo,
    ],
  );
  return rowCount ? 'ok' : 'nao_encontrado';
}
