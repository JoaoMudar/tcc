'use server';

import { revalidatePath } from 'next/cache';
import * as areas from '@/lib/areas';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

const PATH = '/cadastros/areas';

/** RF-13: área identificada por letra. */
export async function createArea(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('areas_canteiros', 'C');
  const fields = { letra: formText(formData, 'letra'), nome: formText(formData, 'nome') };
  const letra = areas.parseLetra(fields.letra);
  if ('error' in letra) return { error: letra.error, fields };
  const nome = areas.parseNomeArea(fields.nome);
  if ('error' in nome) return { error: nome.error, fields };

  try {
    await areas.insertArea(pool, { letra: letra.value, nome: nome.value });
  } catch (error) {
    return { error: areas.duplicateAreaMessage(error, letra.value) ?? toUserMessage(error), fields };
  }

  revalidatePath(PATH);
  return { success: `Área ${letra.value} criada.` };
}

/** Só área vazia: excluir com canteiro levaria os canteiros junto. */
export async function deleteArea(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('areas_canteiros', 'E');
  const id = formText(formData, 'area_id');
  if (!isUuid(id)) return { error: 'Área inválida.' };

  try {
    const result = await areas.deleteArea(pool, id);
    if (result === 'nao_encontrado') return { error: 'Área não encontrada.' };
    if (result === 'tem_canteiros') return { error: 'Exclua os canteiros da área antes de excluir a área.' };
  } catch (error) {
    return { error: areas.emUsoMessage(error, 'A área') ?? toUserMessage(error) };
  }

  revalidatePath(PATH);
  return { success: 'Área excluída.' };
}

/** RF-13: número repetido na mesma área é recusado; a numeração recomeça em cada área. */
export async function createCanteiro(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('areas_canteiros', 'C');
  const areaId = formText(formData, 'area_id');
  if (!isUuid(areaId)) return { error: 'Área inválida.' };
  const fields = { numero: formText(formData, 'numero'), capacidade: formText(formData, 'capacidade') };
  const numero = areas.parseNumeroCanteiro(fields.numero);
  if ('error' in numero) return { error: numero.error, fields };
  const capacidade = areas.parseCapacidade(fields.capacidade);
  if ('error' in capacidade) return { error: capacidade.error, fields };

  try {
    const id = await areas.insertCanteiro(pool, { areaId, numero: numero.value, capacidade: capacidade.value });
    if (!id) return { error: 'Área não encontrada.' };
  } catch (error) {
    const letra = await areas.findLetraDaArea(pool, areaId).catch(() => null);
    return { error: areas.duplicateCanteiroMessage(error, numero.value, letra) ?? toUserMessage(error), fields };
  }

  revalidatePath(PATH);
  return { success: `Canteiro ${numero.value} criado.` };
}

export async function deleteCanteiro(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('areas_canteiros', 'E');
  const id = formText(formData, 'canteiro_id');
  if (!isUuid(id)) return { error: 'Canteiro inválido.' };

  try {
    if ((await areas.deleteCanteiro(pool, id)) === 'nao_encontrado') return { error: 'Canteiro não encontrado.' };
  } catch (error) {
    return { error: areas.emUsoMessage(error, 'O canteiro') ?? toUserMessage(error) };
  }

  revalidatePath(PATH);
  return { success: 'Canteiro excluído.' };
}
