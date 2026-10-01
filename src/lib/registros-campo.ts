import type { PoolClient } from 'pg';
import * as agenda from './agenda';
import type { SessionUser } from './auth/session-store';
import pool from './db';
import { type Envio, type TipoEnvio, executarUmaVez } from './envios';
import { isErroDefinitivo, toUserMessage } from './errors';
import * as lotes from './lotes';
import { CAUSAS_PERDA, formatQuantidade, isCausaPerda, registrarMovimento } from './movimentos';
import { type Operacao, type Recurso, can } from './permissions';
import { withTransaction } from './transaction';
import { isUuid } from './uuid';

/**
 * O registro de campo que pode ser feito sem conexão (T9.3, RNF-05): perda,
 * contagem e confirmação de tarefa. Chega pela fila do aparelho, em
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

/** T4.5, RF-37, RF-38: lote, quantidade, causa e observação. Espécie, recipiente e canteiro vêm do lote. */
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
 * T4.6, RF-39: o contado passa a valer, e a diferença vira o ajuste. A diferença
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

/** T5.5, RF-29, UC-20: o lote uma vez, a quantidade de cada um, e as mudas que morreram viram perda do lote. */
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
    perdidas: campo(campos, 'perdidas'),
    causa: campo(campos, 'causa'),
    ...Object.fromEntries(Object.entries(quantidades).map(([pessoa, texto]) => [`quantidade_${pessoa}`, texto])),
  };
  const confirmacao = agenda.parseConfirmacao(
    atribuicao,
    atribuicao.participantes.map((p) => p.id),
    { loteId: fields.lote_id, areaId: fields.area_id, canteiroId: fields.canteiro_id, quantidades, perdidas: fields.perdidas, causa: fields.causa },
  );
  if ('error' in confirmacao) return { status: 'recusado', error: confirmacao.error, fields };
  if (confirmacao.value.perda && !can(user.perfil, 'perdas', 'C')) return { status: 'proibido' };

  const { loteId, perda } = confirmacao.value;
  // UC-20 FA-1: a repicagem precisa do destino das mudas, e continua no formulário do lote
  // O toque único da agenda do celular fica onde está: a lista se atualiza sozinha
  const destino =
    campo(campos, 'depois') === 'ficar'
      ? undefined
      : campo(campos, 'depois') === 'repicar' && loteId
      ? `/producao/lotes/${loteId}?repicar=${id}`
      : perda
        ? `/producao/agenda/${id}?feito=confirmada&perda=${perda.quantidade}&causa=${perda.causa}`
        : `/producao/agenda/${id}?feito=confirmada`;

  return gravar(envio, fields, async (client) => {
    await agenda.confirmarAtribuicao(client, id, confirmacao.value, envio.usuarioId);
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
  }
}
