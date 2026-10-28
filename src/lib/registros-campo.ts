import type { PoolClient } from 'pg';
import * as agenda from './agenda';
import type { SessionUser } from './auth/session-store';
import { hojeNoViveiro, isDataIso } from './datas';
import pool from './db';
import { type Envio, type TipoEnvio, executarUmaVez } from './envios';
import { UserError, isErroDefinitivo, toUserMessage } from './errors';
import * as lotes from './lotes';
import { CAUSAS_PERDA, formatQuantidade, isCausaPerda, registrarMovimento } from './movimentos';
import { formatAltura, parseAltura } from './pedidos-rotulos';
import { type Operacao, type Recurso, can } from './permissions';
import { inicioDaSemana } from './semanas';
import { findTipoTarefa } from './tipos-tarefa';
import { withTransaction } from './transaction';
import { isUuid } from './uuid';

/**
 * O registro de campo que pode ser feito sem conexão (T9.3, RNF-04): perda,
 * contagem, confirmação de tarefa, altura do lote e tarefa feita fora da agenda
 * (as duas últimas desde 27/10/2026, migration 20261027000005). Chega pela fila do aparelho, em
 * `/api/registros`, com a chave gerada lá; a chave e o registro gravam na mesma
 * transação (`executarUmaVez`), e o reenvio recebe a resposta da primeira vez.
 *
 * O erro que repetir não resolve volta como `recusado`, com a mensagem para a
 * tela. Qualquer outro é relançado: a fila trata como falha de rede e tenta de novo.
 */

export type Campos = Record<string, string>;

export type ResultadoRegistro =
  | { status: 'gravado'; success: string; destino?: string; repetido: boolean }
  | { status: 'recusado'; error: string; fields?: Campos }
  | { status: 'proibido' };

interface Gravado {
  success: string;
  destino?: string;
}

/** Recurso e operação que cada tipo exige, os mesmos das Server Actions que ele substituiu (D4). */
export const PERMISSAO_DO_ENVIO: Record<TipoEnvio, [Recurso, Operacao]> = {
  perda: ['perdas', 'C'],
  contagem: ['movimentos_lote', 'C'],
  confirmacao_tarefa: ['confirmacao_tarefa', 'C'],
  altura: ['lotes', 'A'],
  // A tarefa feita é lançar e confirmar: exige também `confirmacao_tarefa`, conferida dentro
  tarefa_feita: ['agenda', 'C'],
};

function campo(campos: Campos, nome: string): string {
  const valor = campos[nome];
  return typeof valor === 'string' ? valor : '';
}

function textoSaldo(saldo: number, encerrado: boolean): string {
  return encerrado
    ? 'O lote zerou e foi encerrado; o canteiro ficou livre.'
    : `O lote fica com ${formatQuantidade(saldo)} ${saldo === 1 ? 'muda' : 'mudas'}.`;
}

async function gravar(
  envio: Envio,
  fields: Campos | undefined,
  registrar: (client: PoolClient) => Promise<Gravado>,
): Promise<ResultadoRegistro> {
  try {
    const { resposta, repetido } = await withTransaction(pool, (client) => executarUmaVez(client, envio, () => registrar(client)));
    return { status: 'gravado', ...resposta, repetido };
  } catch (error) {
    if (isErroDefinitivo(error)) return { status: 'recusado', error: toUserMessage(error), fields };
    throw error;
  }
}

/** T4.5, RF-24, RF-25: lote, quantidade, causa e observação. Espécie, recipiente e canteiro vêm do lote. */
async function registrarPerda(campos: Campos, envio: Envio): Promise<ResultadoRegistro> {
  const loteId = campo(campos, 'lote_id');
  if (!isUuid(loteId)) return { status: 'recusado', error: 'Lote inválido.' };
  const fields = {
    quantidade: campo(campos, 'quantidade'),
    causa: campo(campos, 'causa'),
    observacoes: campo(campos, 'observacoes'),
  };
  const quantidade = lotes.parseQuantidade(fields.quantidade);
  if ('error' in quantidade) return { status: 'recusado', error: quantidade.error, fields };
  if (!isCausaPerda(fields.causa)) return { status: 'recusado', error: 'Escolha a causa da perda.', fields };
  const causa = fields.causa;
  const observacoes = lotes.parseObservacoes(fields.observacoes);
  if ('error' in observacoes) return { status: 'recusado', error: observacoes.error, fields };

  return gravar(envio, fields, async (client) => {
    const { saldo, encerrado } = await registrarMovimento(client, {
      loteId,
      tipo: 'perda',
      quantidade: -quantidade.value,
      causa,
      observacoes: observacoes.value,
      registradoPor: envio.usuarioId,
    });
    return {
      success: `Perda de ${formatQuantidade(quantidade.value)} por ${CAUSAS_PERDA[causa].toLowerCase()} registrada. ${textoSaldo(saldo, encerrado)}`,
    };
  });
}

/**
 * T4.6, RF-26: o contado passa a valer, e a diferença vira o ajuste. A diferença
 * é calculada contra o saldo **na hora em que chega**, e não na hora em que foi
 * digitada: a contagem diz quantas mudas há, e é isso que tem de valer.
 */
async function registrarContagem(campos: Campos, envio: Envio): Promise<ResultadoRegistro> {
  const loteId = campo(campos, 'lote_id');
  if (!isUuid(loteId)) return { status: 'recusado', error: 'Lote inválido.' };
  const fields = { contado: campo(campos, 'contado'), observacoes: campo(campos, 'observacoes') };
  const contado = lotes.parseQuantidade(fields.contado, { zero: true });
  if ('error' in contado) return { status: 'recusado', error: contado.error, fields };
  const observacoes = lotes.parseObservacoes(fields.observacoes);
  if ('error' in observacoes) return { status: 'recusado', error: observacoes.error, fields };

  return gravar(envio, fields, async (client) => {
    const resultado = await lotes.contarLote(client, {
      loteId,
      contado: contado.value,
      observacoes: observacoes.value,
      registradoPor: envio.usuarioId,
    });
    if (resultado.diferenca === 0) return { success: 'A contagem bate com o saldo. Nada a ajustar.' };
    const sinal = resultado.diferenca > 0 ? 'a mais' : 'a menos';
    return {
      success: `Contagem registrada: ${formatQuantidade(Math.abs(resultado.diferenca))} ${sinal} que o calculado. ${textoSaldo(resultado.saldo, resultado.encerrado)}`,
    };
  });
}

/** T5.5, RF-40, UC-20: o lote uma vez, a quantidade de cada um, e as mudas que morreram viram perda do lote. */
async function confirmarTarefa(campos: Campos, envio: Envio, user: SessionUser): Promise<ResultadoRegistro> {
  const id = campo(campos, 'id');
  if (!isUuid(id)) return { status: 'recusado', error: 'Tarefa inválida.' };
  const atribuicao = await agenda.findAtribuicao(pool, id);
  if (!atribuicao) return { status: 'recusado', error: 'Tarefa não encontrada.' };

  const quantidades = Object.fromEntries(atribuicao.participantes.map((p) => [p.id, campo(campos, `quantidade_${p.id}`)]));
  const fields: Campos = {
    lote_id: campo(campos, 'lote_id'),
    area_id: campo(campos, 'area_id'),
    canteiro_id: campo(campos, 'canteiro_id'),
    especie_id: campo(campos, 'especie_id'),
    recipiente_id: campo(campos, 'recipiente_id'),
    perdidas: campo(campos, 'perdidas'),
    causa: campo(campos, 'causa'),
    ...Object.fromEntries(Object.entries(quantidades).map(([pessoa, texto]) => [`quantidade_${pessoa}`, texto])),
  };
  const confirmacao = agenda.parseConfirmacao(
    atribuicao,
    atribuicao.participantes.map((p) => p.id),
    {
      loteId: fields.lote_id,
      areaId: fields.area_id,
      canteiroId: fields.canteiro_id,
      especieId: fields.especie_id,
      recipienteId: fields.recipiente_id,
      quantidades,
      perdidas: fields.perdidas,
      causa: fields.causa,
    },
  );
  if ('error' in confirmacao) return { status: 'recusado', error: confirmacao.error, fields };
  if (confirmacao.value.perda && !can(user.perfil, 'perdas', 'C')) return { status: 'proibido' };

  const { perda } = confirmacao.value;
  // Confirmada, volta à agenda do dia; o toque único da agenda do celular fica onde está, e a lista se atualiza sozinha
  const agendaDoDia = `/producao?dia=${atribuicao.data}&feito=confirmada`;
  const destino =
    campo(campos, 'depois') === 'ficar'
      ? undefined
      : perda
        ? `${agendaDoDia}&perda=${perda.quantidade}&causa=${perda.causa}`
        : agendaDoDia;

  return gravar(envio, fields, async (client) => {
    await agenda.confirmarAtribuicao(client, id, confirmacao.value, envio.usuarioId);
    return { success: 'Tarefa confirmada.', destino };
  });
}

/** RF-31: a altura medida na trena. Vazia apaga. */
async function registrarAltura(campos: Campos, envio: Envio): Promise<ResultadoRegistro> {
  const loteId = campo(campos, 'lote_id');
  if (!isUuid(loteId)) return { status: 'recusado', error: 'Lote inválido.' };
  const fields = { altura: campo(campos, 'altura') };
  const altura = parseAltura(fields.altura);
  if ('error' in altura) return { status: 'recusado', error: altura.error, fields };

  return gravar(envio, fields, async (client) => {
    if ((await lotes.alterarAltura(client, loteId, altura.value, envio.usuarioId)) === 'nao_encontrado') {
      throw new UserError('Lote não encontrado, ou já encerrado.');
    }
    return { success: altura.value === null ? 'Altura apagada.' : `Altura registrada: ${formatAltura(altura.value)}.` };
  });
}

/**
 * RF-55: a etapa feita fora da agenda, lançada e confirmada no mesmo gesto. A
 * lista de quem fez chega em `participantes_lista`: a fila guarda um valor por
 * nome, e as marcações repetem o nome.
 */
async function registrarTarefaFeitaCampo(campos: Campos, envio: Envio, user: SessionUser): Promise<ResultadoRegistro> {
  if (!can(user.perfil, 'confirmacao_tarefa', 'C')) return { status: 'proibido' };
  const participantes = campo(campos, 'participantes_lista').split(',').filter(Boolean);
  const dia = campo(campos, 'dias');
  const quantidades = Object.fromEntries(participantes.map((p) => [p, campo(campos, `quantidade_${p}`)]));
  const fields: Campos = { ...campos };
  if (!isDataIso(dia)) return { status: 'recusado', error: 'Escolha o dia em que a tarefa foi feita.', fields };
  if (dia > hojeNoViveiro()) return { status: 'recusado', error: 'O dia em que foi feita não pode estar no futuro.', fields };
  const tipoId = campo(campos, 'tipo_tarefa_id');
  if (!isUuid(tipoId)) return { status: 'recusado', error: 'Tipo de tarefa inválido.', fields };
  const tipo = await findTipoTarefa(pool, tipoId);
  if (!tipo) return { status: 'recusado', error: 'Tipo de tarefa não encontrado.', fields };

  const bruta: agenda.AtribuicaoBruta = {
    semana: inicioDaSemana(dia),
    dias: [dia],
    turnoId: campo(campos, 'turno_id'),
    horaInicio: '',
    horaFim: '',
    participantes,
    loteId: campo(campos, 'lote_id'),
    especieId: campo(campos, 'especie_id'),
    recipienteId: campo(campos, 'recipiente_id'),
    areaId: campo(campos, 'area_id'),
    canteiroId: campo(campos, 'canteiro_id'),
    quantidadePlanejada: '',
    recorrente: false,
    observacoes: '',
    loteEtapaId: campo(campos, 'lote_etapa_id'),
  };
  // RF-37: a etapa é de um lote, e é ele quem diz a espécie e o recipiente que o tipo declara
  if ((tipo.exigeEspecie || tipo.exigeRecipiente) && isUuid(bruta.loteId)) {
    const lote = await lotes.findLote(pool, bruta.loteId);
    if (lote) {
      bruta.especieId ||= lote.especieId;
      bruta.recipienteId ||= lote.recipienteId;
    }
  }
  const atribuicao = agenda.parseAtribuicao(tipo, bruta);
  if ('error' in atribuicao) return { status: 'recusado', error: atribuicao.error, fields };
  const confirmacao = agenda.parseConfirmacao(tipo, atribuicao.value.participantes, {
    loteId: bruta.loteId,
    areaId: bruta.areaId,
    canteiroId: bruta.canteiroId,
    especieId: bruta.especieId,
    recipienteId: bruta.recipienteId,
    quantidades,
    perdidas: campo(campos, 'perdidas'),
    causa: campo(campos, 'causa'),
  });
  if ('error' in confirmacao) return { status: 'recusado', error: confirmacao.error, fields };
  const { perda } = confirmacao.value;
  if (perda && !can(user.perfil, 'perdas', 'C')) return { status: 'proibido' };

  const agendaDoDia = `/producao?dia=${dia}&feito=confirmada`;
  const destino = perda ? `${agendaDoDia}&perda=${perda.quantidade}&causa=${perda.causa}` : agendaDoDia;
  return gravar(envio, fields, async (client) => {
    await agenda.registrarTarefaFeita(client, atribuicao.value, confirmacao.value, envio.usuarioId);
    return { success: 'Tarefa confirmada.', destino };
  });
}

export async function processarRegistro(tipo: TipoEnvio, chave: string, campos: Campos, user: SessionUser): Promise<ResultadoRegistro> {
  const [recurso, operacao] = PERMISSAO_DO_ENVIO[tipo];
  if (!can(user.perfil, recurso, operacao)) return { status: 'proibido' };
  const envio: Envio = { chave, tipo, usuarioId: user.usuarioId };
  switch (tipo) {
    case 'perda':
      return registrarPerda(campos, envio);
    case 'contagem':
      return registrarContagem(campos, envio);
    case 'confirmacao_tarefa':
      return confirmarTarefa(campos, envio, user);
    case 'altura':
      return registrarAltura(campos, envio);
    case 'tarefa_feita':
      return registrarTarefaFeitaCampo(campos, envio, user);
  }
}
