'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { conferirAtribuicaoDaRepicagem } from '@/lib/agenda';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { hojeNoViveiro } from '@/lib/datas';
import * as lotes from '@/lib/lotes';
import { CAUSAS_PERDA, formatQuantidade, isCausaPerda, registrarMovimento } from '@/lib/movimentos';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

function revalidarProducao() {
  // Ocupação, ficha, perdas e saldo pronto leem o mesmo saldo
  revalidatePath('/producao', 'layout');
}

function textoSaldo(saldo: number, encerrado: boolean): string {
  return encerrado
    ? 'O lote zerou e foi encerrado; o canteiro ficou livre.'
    : `O lote fica com ${formatQuantidade(saldo)} ${saldo === 1 ? 'muda' : 'mudas'}.`;
}

/** T4.2, RF-32. */
export async function criarLoteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('lotes', 'C');
  const fields = {
    especie_id: formText(formData, 'especie_id'),
    recipiente_id: formText(formData, 'recipiente_id'),
    area_id: formText(formData, 'area_id'),
    canteiro_id: formText(formData, 'canteiro_id'),
    quantidade: formText(formData, 'quantidade'),
    data_criacao: formText(formData, 'data_criacao'),
    observacoes: formText(formData, 'observacoes'),
  };
  if (!isUuid(fields.especie_id)) return { error: 'Escolha a espécie.', fields };
  if (!isUuid(fields.recipiente_id)) return { error: 'Escolha o recipiente.', fields };
  if (!isUuid(fields.canteiro_id)) return { error: 'Escolha a área e o canteiro.', fields };
  const quantidade = lotes.parseQuantidade(fields.quantidade);
  if ('error' in quantidade) return { error: quantidade.error, fields };
  const dataCriacao = lotes.parseDataCriacao(fields.data_criacao, hojeNoViveiro());
  if ('error' in dataCriacao) return { error: dataCriacao.error, fields };
  const observacoes = lotes.parseObservacoes(fields.observacoes);
  if ('error' in observacoes) return { error: observacoes.error, fields };

  let id: string;
  try {
    ({ id } = await withTransaction(pool, (client) =>
      lotes.criarLote(client, {
        especieId: fields.especie_id,
        recipienteId: fields.recipiente_id,
        canteiroId: fields.canteiro_id,
        quantidade: quantidade.value,
        dataCriacao: dataCriacao.value,
        observacoes: observacoes.value,
        registradoPor: user.usuarioId,
      }),
    ));
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }

  revalidarProducao();
  redirect(`/producao/lotes/${id}?feito=criado`);
}

/** T4.5, RF-37, RF-38: lote, quantidade, causa e observação. Espécie, recipiente e canteiro vêm do lote. */
export async function registrarPerdaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('perdas', 'C');
  const loteId = formText(formData, 'lote_id');
  if (!isUuid(loteId)) return { error: 'Lote inválido.' };
  const fields = {
    quantidade: formText(formData, 'quantidade'),
    causa: formText(formData, 'causa'),
    observacoes: formText(formData, 'observacoes'),
  };
  const quantidade = lotes.parseQuantidade(fields.quantidade);
  if ('error' in quantidade) return { error: quantidade.error, fields };
  if (!isCausaPerda(fields.causa)) return { error: 'Escolha a causa da perda.', fields };
  const causa = fields.causa;
  const observacoes = lotes.parseObservacoes(fields.observacoes);
  if ('error' in observacoes) return { error: observacoes.error, fields };

  try {
    const { saldo, encerrado } = await withTransaction(pool, (client) =>
      registrarMovimento(client, {
        loteId,
        tipo: 'perda',
        quantidade: -quantidade.value,
        causa,
        observacoes: observacoes.value,
        registradoPor: user.usuarioId,
      }),
    );
    revalidarProducao();
    return {
      success: `Perda de ${formatQuantidade(quantidade.value)} por ${CAUSAS_PERDA[causa].toLowerCase()} registrada. ${textoSaldo(saldo, encerrado)}`,
    };
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }
}

/** T4.6, RF-39: o contado passa a valer, e a diferença vira o ajuste. */
export async function registrarContagemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('movimentos_lote', 'C');
  const loteId = formText(formData, 'lote_id');
  if (!isUuid(loteId)) return { error: 'Lote inválido.' };
  const fields = { contado: formText(formData, 'contado'), observacoes: formText(formData, 'observacoes') };
  const contado = lotes.parseQuantidade(fields.contado, { zero: true });
  if ('error' in contado) return { error: contado.error, fields };
  const observacoes = lotes.parseObservacoes(fields.observacoes);
  if ('error' in observacoes) return { error: observacoes.error, fields };

  try {
    const resultado = await withTransaction(pool, (client) =>
      lotes.contarLote(client, { loteId, contado: contado.value, observacoes: observacoes.value, registradoPor: user.usuarioId }),
    );
    if (resultado.diferenca === 0) return { success: 'A contagem bate com o saldo. Nada a ajustar.' };
    revalidarProducao();
    const sinal = resultado.diferenca > 0 ? 'a mais' : 'a menos';
    return {
      success: `Contagem registrada: ${formatQuantidade(Math.abs(resultado.diferenca))} ${sinal} que o calculado. ${textoSaldo(resultado.saldo, resultado.encerrado)}`,
    };
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }
}

/** T4.7: a mesma leva muda de canteiro; o código não muda. */
export async function transferirLoteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('movimentos_lote', 'C');
  const loteId = formText(formData, 'lote_id');
  if (!isUuid(loteId)) return { error: 'Lote inválido.' };
  const fields = { area_id: formText(formData, 'area_id'), canteiro_id: formText(formData, 'canteiro_id') };
  if (!isUuid(fields.canteiro_id)) return { error: 'Escolha a área e o canteiro de destino.', fields };

  try {
    await withTransaction(pool, (client) =>
      registrarMovimento(client, { loteId, tipo: 'transferencia', canteiroDestinoId: fields.canteiro_id, registradoPor: user.usuarioId }),
    );
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }
  revalidarProducao();
  return { success: 'Lote transferido.' };
}

/** T4.8, RF-34: baixa o lote de origem e cria o novo apontando para ele, com a perda do processo (RN-27). */
export async function repicarLoteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('movimentos_lote', 'C');
  await requirePermission('lotes', 'C');
  const loteId = formText(formData, 'lote_id');
  if (!isUuid(loteId)) return { error: 'Lote inválido.' };
  const fields = {
    quantidade: formText(formData, 'quantidade'),
    perdidas: formText(formData, 'perdidas'),
    causa: formText(formData, 'causa'),
    recipiente_id: formText(formData, 'recipiente_id'),
    area_id: formText(formData, 'area_id'),
    canteiro_id: formText(formData, 'canteiro_id'),
    observacoes: formText(formData, 'observacoes'),
  };
  const quantidade = lotes.parseQuantidade(fields.quantidade);
  if ('error' in quantidade) return { error: quantidade.error, fields };
  const perdidas = fields.perdidas.trim() === '' ? { value: 0 } : lotes.parseQuantidade(fields.perdidas, { zero: true });
  if ('error' in perdidas) return { error: 'As mudas perdidas precisam ser um número inteiro, ou ficar em branco.', fields };
  const causa = isCausaPerda(fields.causa) ? fields.causa : null;
  if (perdidas.value > 0 && !causa) return { error: 'Escolha a causa das mudas que morreram na repicagem.', fields };
  if (!isUuid(fields.recipiente_id)) return { error: 'Escolha o recipiente de destino.', fields };
  if (!isUuid(fields.canteiro_id)) return { error: 'Escolha a área e o canteiro de destino.', fields };
  const observacoes = lotes.parseObservacoes(fields.observacoes);
  if ('error' in observacoes) return { error: observacoes.error, fields };
  // UC-20 FA-1: a repicagem que fecha a tarefa confirmada fica ligada a ela
  const atribuicaoId = formText(formData, 'atribuicao_id') || null;
  if (atribuicaoId !== null && !isUuid(atribuicaoId)) return { error: 'Tarefa inválida.', fields };

  let id: string;
  try {
    ({ id } = await withTransaction(pool, async (client) => {
      if (atribuicaoId) await conferirAtribuicaoDaRepicagem(client, atribuicaoId, loteId);
      return lotes.repicarLote(client, {
        origemId: loteId,
        quantidade: quantidade.value,
        perdidas: perdidas.value,
        causa,
        recipienteId: fields.recipiente_id,
        canteiroId: fields.canteiro_id,
        observacoes: observacoes.value,
        registradoPor: user.usuarioId,
        atribuicaoId,
      });
    }));
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }

  revalidarProducao();
  redirect(`/producao/lotes/${id}?feito=repicado`);
}

/** T4.9, provisório até o protocolo avançar a fase sozinho (T6.7). */
export async function alterarFaseAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('lotes', 'A');
  const loteId = formText(formData, 'lote_id');
  if (!isUuid(loteId)) return { error: 'Lote inválido.' };
  const fase = lotes.parseFase(formText(formData, 'fase'));
  if ('error' in fase) return { error: fase.error };

  try {
    if ((await lotes.alterarFase(pool, loteId, fase.value)) === 'nao_encontrado') {
      return { error: 'Lote não encontrado, ou já encerrado.' };
    }
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarProducao();
  return { success: `Fase alterada para ${lotes.FASES[fase.value].toLowerCase()}.` };
}
