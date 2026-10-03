'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as agenda from '@/lib/agenda';
import pool from '@/lib/db';
import { hojeNoViveiro } from '@/lib/datas';
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
    // A etapa que originou a sugestão (RF-47); o vencimento dela o servidor lê
    lote_etapa_id: formText(formData, 'lote_etapa_id'),
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
      loteEtapaId: fields.lote_etapa_id,
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
  redirect(`/producao?dia=${resultado.value.dias[0]}&feito=lancada`);
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
 * O arrasto na grade da semana (RNF-14). Não redireciona: a grade fica onde
 * está, e quem conta o que mudou é o próprio card no lugar novo.
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
    sai: formText(formData, 'sai'),
    entra: formText(formData, 'entra'),
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

/** RF-26: a tarefa coberta, arrastada para cima na grade, passa a aparecer por inteiro. */
export async function promoverAtribuicaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('agenda', 'A');
  const id = formText(formData, 'id');
  if (!isUuid(id)) return { error: 'Tarefa inválida.' };
  try {
    await withTransaction(pool, (client) => agenda.promoverAtribuicao(client, id));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarProducao();
  return { success: 'Tarefa em destaque.' };
}

export async function excluirAtribuicaoAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('agenda', 'E');
  const id = formText(formData, 'id');
  if (!isUuid(id)) return { error: 'Tarefa inválida.' };

  let data: string;
  try {
    ({ data } = await withTransaction(pool, (client) => agenda.excluirAtribuicao(client, id)));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarProducao();
  redirect(`/producao?dia=${data}&feito=excluida`);
}

function lerSemanaDoForm(formData: FormData): string | null {
  const semana = formText(formData, 'semana');
  return isInicioDeSemana(semana) ? semana : null;
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

/** T5.6, RF-28, RF-31. */
export async function fecharSemanaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('fechamento_semana', 'A');
  const semana = lerSemanaDoForm(formData);
  if (!semana) return { error: 'Semana inválida.' };
  try {
    await withTransaction(pool, (client) => agenda.fecharSemana(client, semana, hojeNoViveiro()));
  } catch (error) {
    return { error: toUserMessage(error) };
  }
  revalidarProducao();
  redirect(`/producao?dia=${semana}&feito=fechada`);
}
