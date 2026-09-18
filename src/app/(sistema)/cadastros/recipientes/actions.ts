'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import * as recipientes from '@/lib/recipientes';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

/** RF-11: recipiente novo, com nome e volume. */
export async function createRecipiente(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('recipientes', 'C');
  const fields = { nome: formText(formData, 'nome'), volume: formText(formData, 'volume') };
  const parsed = recipientes.parseRecipienteFields(fields);
  if ('error' in parsed) return { error: parsed.error, fields };

  try {
    await recipientes.insertRecipiente(pool, parsed.value);
  } catch (error) {
    return { error: recipientes.duplicateMessage(error) ?? toUserMessage(error), fields };
  }

  revalidatePath('/cadastros/recipientes');
  return { success: `Recipiente ${parsed.value.nome} criado.` };
}

/** Nome, volume e uso. Não há exclusão: o recipiente sai de uso desativado. */
export async function updateRecipiente(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('recipientes', 'A');
  const id = formText(formData, 'recipiente_id');
  if (!isUuid(id)) return { error: 'Recipiente inválido.' };
  const parsed = recipientes.parseRecipienteFields({ nome: formText(formData, 'nome'), volume: formText(formData, 'volume') });
  if ('error' in parsed) return { error: parsed.error };

  try {
    const result = await recipientes.updateRecipiente(pool, id, { ...parsed.value, ativo: formData.get('ativo') === 'on' });
    if (result === 'nao_encontrado') return { error: 'Recipiente não encontrado.' };
  } catch (error) {
    return { error: recipientes.duplicateMessage(error) ?? toUserMessage(error) };
  }

  revalidatePath('/cadastros/recipientes');
  return { success: 'Recipiente salvo.' };
}
