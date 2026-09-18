'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as agenda from '@/lib/agenda';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { isInicioDeSemana } from '@/lib/semanas';
import { findTipoTarefa } from '@/lib/tipos-tarefa';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

function revalidarProducao() {
  // Agenda do dia, semana, ficha do lote e perdas leem as mesmas linhas
  revalidatePath('/producao', 'layout');
}

function textos(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((valor): valor is string => typeof valor === 'string' && valor !== '');
}

/** O formulário da atribuição, lido uma vez só para a criação e a alteração. */
function lerAtribuicao(formData: FormData): { fields: Record<string, string>; bruta: agenda.AtribuicaoBruta; tipoId: string } {
  const participantes = textos(formData, 'participantes');
  const dias = textos(formData, 'dias');
  const fields = {
    semana: formText(formData, 'semana'),
    dias: dias.join(','),
    turno_id: formText(formData, 'turno_id'),
    tipo_tarefa_id: formText(formData, 'tipo_tarefa_id'),
    hora_inicio: formText(formData, 'hora_inicio'),
    hora_fim: formText(formData, 'hora_fim'),
    participantes: participantes.join(','),
    lote_id: formText(formData, 'lote_id'),
    especie_id: formText(formData, 'especie_id'),
    recipiente_id: formText(formData, 'recipiente_id'),
    area_id: formText(formData, 'area_id'),
    canteiro_id: formText(formData, 'canteiro_id'),
    quantidade_planejada: formText(formData, 'quantidade_planejada'),
    recorrente: formText(formData, 'recorrente'),
    observacoes: formText(formData, 'observacoes'),
  };
  return {
    fields,
    tipoId: fields.tipo_tarefa_id,
    bruta: {
      semana: fields.semana,
      dias,
      turnoId: fields.turno_id,
      horaInicio: fields.hora_inicio,
      horaFim: fields.hora_fim,
      participantes,
      loteId: fields.lote_id,
      especieId: fields.especie_id,
      recipienteId: fields.recipiente_id,
      areaId: fields.area_id,
      canteiroId: fields.canteiro_id,
      quantidadePlanejada: fields.quantidade_planejada,
      recorrente: fields.recorrente === 'on',
      observacoes: fields.observacoes,
    },
  };
}

async function validarAtribuicao(formData: FormData): Promise<{ fields: Record<string, string> } & ({ error: string } | { value: agenda.AtribuicaoInput })> {
  const { fields, bruta, tipoId } = lerAtribuicao(formData);
  if (!isInicioDeSemana(bruta.semana)) return { error: 'Semana inválida.', fields };
  if (!isUuid(tipoId)) return { error: 'Escolha o tipo de tarefa.', fields };
  const tipo = await findTipoTarefa(pool, tipoId);
  if (!tipo) return { error: 'Tipo de tarefa não encontrado.', fields };
  return { ...agenda.parseAtribuicao(tipo, bruta), fields };
}

/** T5.1, T5.2, RF-26: uma tarefa por dia escolhido, com o grupo inteiro. */
export async function criarAtribuicaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('agenda', 'C');
  const resultado = await validarAtribuicao(formData);
  if ('error' in resultado) return { error: resultado.error, fields: resultado.fields };

  try {
    await withTransaction(pool, (client) => agenda.criarAtribuicoes(client, resultado.value));
  } catch (error) {
    return { error: toUserMessage(error), fields: resultado.fields };
  }
  revalidarProducao();
  redirect(`/producao/agenda?semana=${resultado.value.semana}&feito=lancada`);
}

export async function atualizarAtribuicaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('agenda', 'A');
  const id = formText(formData, 'id');
  if (!isUuid(id)) return { error: 'Tarefa inválida.' };
  const resultado = await validarAtribuicao(formData);
  if ('error' in resultado) return { error: resultado.error, fields: resultado.fields };

  try {
    await withTransaction(pool, (client) => agenda.atualizarAtribuicao(client, id, resultado.value));
  } catch (error) {
    return { error: toUserMessage(error), fields: resultado.fields };
  }
  revalidarProducao();
  redirect(`/producao/agenda/${id}?feito=alterada`);
}

/**
 * O arrasto na linha do tempo da semana (RNF-14). Não redireciona: a grade fica
 * onde está, e quem conta o que mudou é a própria barra no lugar novo.
 */
export async function reagendarAtribuicaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('agenda', 'A');
  const id = formText(formData, 'id');
  if (!isUuid(id)) return { error: 'Tarefa inválida.' };
  const resultado = agenda.parseReagendamento({
    data: formText(formData, 'data'),
    turnoId: formText(formData, 'turno_id'),
    horaInicio: formText(formData, 'hora_inicio'),
    horaFim: formText(formData, 'hora_fim'),
  });
  if ('error' in resultado) return { error: resultado.error };

  try {
    await withTransaction(pool, (client) => agenda.reagendarAtribuicao(client, id, resultado.value));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarProducao();
  return { success: 'Tarefa remarcada.' };
}

export async function excluirAtribuicaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('agenda', 'E');
  const id = formText(formData, 'id');
  if (!isUuid(id)) return { error: 'Tarefa inválida.' };

  let semanaInicio: string;
  try {
    ({ semanaInicio } = await withTransaction(pool, (client) => agenda.excluirAtribuicao(client, id)));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarProducao();
  redirect(`/producao/agenda?semana=${semanaInicio}&feito=excluida`);
}

/** T5.5, RF-29, UC-20: o lote uma vez, a quantidade de cada um, e as mudas que morreram viram perda do lote. */
export async function confirmarAtribuicaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('confirmacao_tarefa', 'C');
  const id = formText(formData, 'id');
  if (!isUuid(id)) return { error: 'Tarefa inválida.' };
  const atribuicao = await agenda.findAtribuicao(pool, id);
  if (!atribuicao) return { error: 'Tarefa não encontrada.' };

  const quantidades = Object.fromEntries(atribuicao.participantes.map((p) => [p.id, formText(formData, `quantidade_${p.id}`)]));
  const fields: Record<string, string> = {
    lote_id: formText(formData, 'lote_id'),
    area_id: formText(formData, 'area_id'),
    canteiro_id: formText(formData, 'canteiro_id'),
    perdidas: formText(formData, 'perdidas'),
    causa: formText(formData, 'causa'),
    ...Object.fromEntries(Object.entries(quantidades).map(([pessoa, texto]) => [`quantidade_${pessoa}`, texto])),
  };
  const confirmacao = agenda.parseConfirmacao(
    atribuicao,
    atribuicao.participantes.map((p) => p.id),
    { loteId: fields.lote_id, areaId: fields.area_id, canteiroId: fields.canteiro_id, quantidades, perdidas: fields.perdidas, causa: fields.causa },
  );
  if ('error' in confirmacao) return { error: confirmacao.error, fields };
  if (confirmacao.value.perda) await requirePermission('perdas', 'C');

  try {
    await withTransaction(pool, (client) => agenda.confirmarAtribuicao(client, id, confirmacao.value, user.usuarioId));
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }
  revalidarProducao();

  const { loteId, perda } = confirmacao.value;
  // UC-20 FA-1: a repicagem precisa do destino das mudas, e continua no formulário do lote
  if (formText(formData, 'depois') === 'repicar' && loteId) redirect(`/producao/lotes/${loteId}?repicar=${id}`);
  redirect(
    perda
      ? `/producao/agenda/${id}?feito=confirmada&perda=${perda.quantidade}&causa=${perda.causa}`
      : `/producao/agenda/${id}?feito=confirmada`,
  );
}

function lerSemanaDoForm(formData: FormData): string | null {
  const semana = formText(formData, 'semana');
  return isInicioDeSemana(semana) ? semana : null;
}

/** RN-29: abrir traz as recorrentes da semana passada. */
export async function abrirSemanaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('agenda', 'C');
  const semana = lerSemanaDoForm(formData);
  if (!semana) return { error: 'Semana inválida.' };
  try {
    const { recorrentes } = await withTransaction(pool, (client) => agenda.abrirSemana(client, semana));
    revalidarProducao();
    return {
      success:
        recorrentes === 0
          ? 'Semana aberta. A semana passada não tinha tarefa recorrente.'
          : `Semana aberta, com ${recorrentes} ${recorrentes === 1 ? 'tarefa recorrente' : 'tarefas recorrentes'} da semana passada.`,
    };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

/** T5.4, RF-27. */
export async function copiarSemanaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('agenda', 'C');
  const semana = lerSemanaDoForm(formData);
  if (!semana) return { error: 'Semana inválida.' };
  try {
    const { copiadas, recorrentes } = await withTransaction(pool, (client) => agenda.copiarSemanaAnterior(client, semana));
    revalidarProducao();
    const total = copiadas + recorrentes;
    return { success: `${formatQuantidade(total)} ${total === 1 ? 'tarefa copiada' : 'tarefas copiadas'} da semana passada. Ajuste o que mudou.` };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}

/** T5.3, RF-28. */
export async function publicarSemanaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('agenda', 'A');
  const semana = lerSemanaDoForm(formData);
  if (!semana) return { error: 'Semana inválida.' };
  try {
    await withTransaction(pool, (client) => agenda.publicarSemana(client, semana, user.usuarioId));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarProducao();
  return { success: 'Semana publicada.' };
}

/** T5.6, RF-28, RF-31. */
export async function fecharSemanaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('fechamento_semana', 'A');
  const semana = lerSemanaDoForm(formData);
  if (!semana) return { error: 'Semana inválida.' };
  try {
    await withTransaction(pool, (client) => agenda.fecharSemana(client, semana));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarProducao();
  redirect(`/producao/agenda?semana=${semana}&feito=fechada`);
}
