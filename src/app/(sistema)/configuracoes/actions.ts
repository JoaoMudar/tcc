'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { listParametros, saveParametros, validateParametros } from '@/lib/parametros';
import { withTransaction } from '@/lib/transaction';
import * as turnos from '@/lib/turnos';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

const VALOR_PREFIX = 'valor:';

/** RF-08: turno novo, com nome e horários. */
export async function createTurno(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('periodo_trabalho', 'C');
  const fields = { nome: formText(formData, 'nome'), inicio: formText(formData, 'inicio'), fim: formText(formData, 'fim') };

  const nome = turnos.parseNomeTurno(fields.nome);
  if ('error' in nome) return { error: nome.error, fields };
  const horarios = turnos.parseTurnoFields(fields);
  if ('error' in horarios) return { error: horarios.error, fields };

  try {
    await turnos.insertTurno(pool, { nome: nome.value, ...horarios.value });
  } catch (error) {
    return { error: turnos.duplicateMessage(error) ?? toUserMessage(error), fields };
  }

  revalidatePath('/configuracoes/periodo');
  return { success: `Turno ${turnos.turnoLabel(nome.value)} criado.` };
}

/** RF-08: horários e uso do turno. Não há exclusão: o turno sai de uso desativado. */
export async function updateTurno(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('periodo_trabalho', 'A');
  const id = formText(formData, 'turno_id');
  if (!isUuid(id)) return { error: 'Turno inválido.' };

  const horarios = turnos.parseTurnoFields({ inicio: formText(formData, 'inicio'), fim: formText(formData, 'fim') });
  if ('error' in horarios) return { error: horarios.error };

  try {
    const result = await turnos.updateTurno(pool, id, { ...horarios.value, ativo: formData.get('ativo') === 'on' });
    if (result === 'nao_encontrado') return { error: 'Turno não encontrado.' };
  } catch (error) {
    return { error: toUserMessage(error) };
  }

  revalidatePath('/configuracoes/periodo');
  return { success: 'Horário salvo.' };
}

/** RF-09: altera só o valor. Não existe action de criar nem de excluir parâmetro (D4 §3.7). */
export async function updateParametros(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission('parametros', 'A');
  const valores: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (name.startsWith(VALOR_PREFIX) && typeof value === 'string') valores[name.slice(VALOR_PREFIX.length)] = value;
  }
  const fields = Object.fromEntries(Object.entries(valores).map(([chave, valor]) => [`${VALOR_PREFIX}${chave}`, valor]));

  try {
    const parsed = validateParametros(await listParametros(pool), valores);
    if ('error' in parsed) return { error: parsed.error, fields };
    const result = await withTransaction(pool, (client) => saveParametros(client, parsed.value, user.usuarioId));
    if (result === 'desconhecido') return { error: 'Parâmetro desconhecido. Não é possível criar parâmetro.', fields };
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }

  revalidatePath('/configuracoes/parametros');
  return { success: 'Alterações salvas. Os novos valores já valem nas próximas telas.' };
}
