'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import * as tipos from '@/lib/tipos-tarefa';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

/** RF-21: cria (sem `tipo_id`) ou altera o tipo de tarefa e as declarações que comandam o formulário. */
export async function saveTipoTarefa(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = formText(formData, 'tipo_id');
  await requirePermission('tipos_tarefa', id ? 'A' : 'C');
  if (id && !isUuid(id)) return { error: 'Tipo de tarefa inválido.' };

  const fields = { nome: formText(formData, 'nome'), categoria: formText(formData, 'categoria') };
  const marcado = (name: string) => formData.get(name) === 'on';
  const parsed = tipos.parseTipoTarefaFields({
    ...fields,
    eQuantitativa: marcado('e_quantitativa'),
    exigeLote: marcado('exige_lote'),
    exigeEspecie: marcado('exige_especie'),
    exigeRecipiente: marcado('exige_recipiente'),
  });
  if ('error' in parsed) return { error: parsed.error, fields };

  let novoId: string;
  try {
    if (id) {
      const result = await tipos.updateTipoTarefa(pool, id, { ...parsed.value, ativo: marcado('ativo') });
      if (result === 'nao_encontrado') return { error: 'Tipo de tarefa não encontrado.' };
      novoId = id;
    } else {
      novoId = await tipos.insertTipoTarefa(pool, parsed.value);
    }
  } catch (error) {
    return { error: tipos.duplicateMessage(error) ?? toUserMessage(error), fields };
  }

  revalidatePath('/cadastros/tipos-tarefa');
  if (!id) redirect(`/cadastros/tipos-tarefa/${novoId}?salvo=1`);
  revalidatePath(`/cadastros/tipos-tarefa/${id}`);
  return { success: 'Tipo de tarefa salvo.' };
}
