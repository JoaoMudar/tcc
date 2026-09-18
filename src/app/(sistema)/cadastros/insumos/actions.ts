'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import * as insumos from '@/lib/insumos';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

function readFields(formData: FormData) {
  return {
    nome: formText(formData, 'nome'),
    categoria: formText(formData, 'categoria'),
    unidade_medida: formText(formData, 'unidade_medida'),
  };
}

/** RF-12: insumo com unidade de medida e categoria. */
export async function createInsumo(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('insumos', 'C');
  const fields = readFields(formData);
  const parsed = insumos.parseInsumoFields({ ...fields, unidadeMedida: fields.unidade_medida });
  if ('error' in parsed) return { error: parsed.error, fields };

  try {
    await insumos.insertInsumo(pool, parsed.value);
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }

  revalidatePath('/cadastros/insumos');
  return { success: `Insumo ${parsed.value.nome} criado.` };
}

/** Não há exclusão: o insumo sai de uso desativado. */
export async function updateInsumo(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('insumos', 'A');
  const id = formText(formData, 'insumo_id');
  if (!isUuid(id)) return { error: 'Insumo inválido.' };
  const fields = readFields(formData);
  const parsed = insumos.parseInsumoFields({ ...fields, unidadeMedida: fields.unidade_medida });
  if ('error' in parsed) return { error: parsed.error };

  try {
    const result = await insumos.updateInsumo(pool, id, { ...parsed.value, ativo: formData.get('ativo') === 'on' });
    if (result === 'nao_encontrado') return { error: 'Insumo não encontrado.' };
  } catch (error) {
    return { error: toUserMessage(error) };
  }

  revalidatePath('/cadastros/insumos');
  return { success: 'Insumo salvo.' };
}
