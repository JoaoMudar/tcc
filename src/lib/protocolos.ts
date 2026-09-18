import { type Fase, FASES_EDITAVEIS } from './lotes-rotulos';
import { type TipoAgendamento, type TipoAncora, isTipoAgendamento, isTipoAncora } from './protocolo-rotulos';
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
