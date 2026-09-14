'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { duplicateMessage, parseEspecieFields, saveEspecie } from '@/lib/especies';
import { type FormState, formText } from '@/lib/form-state';
import { readFotoFile } from '@/lib/fotos';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

/** RF-10: cria (sem `especie_id`) ou altera a espécie, com nomes e foto numa transação só. */
export async function saveEspecieAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = formText(formData, 'especie_id');
  await requirePermission('especies', id ? 'A' : 'C');
  if (id && !isUuid(id)) return { error: 'Espécie inválida.' };

  const caracteristicas = formData.getAll('caracteristicas').filter((v): v is string => typeof v === 'string');
  const fields = {
    nome_cientifico: formText(formData, 'nome_cientifico'),
    nomes_populares: formText(formData, 'nomes_populares'),
    observacoes: formText(formData, 'observacoes'),
    caracteristicas: caracteristicas.join(','),
  };
  const parsed = parseEspecieFields({
    nomeCientifico: fields.nome_cientifico,
    nomesPopulares: fields.nomes_populares,
    caracteristicas,
    observacoes: fields.observacoes,
  });
  if ('error' in parsed) return { error: parsed.error, fields };

  const foto = await readFotoFile(formData.get('foto'));
  if ('error' in foto) return { error: foto.error, fields };

  let novoId: string;
  try {
    const result = await withTransaction(pool, (client) =>
      saveEspecie(
        client,
        id || null,
        { ...parsed.value, ativa: id ? formData.get('ativa') === 'on' : true },
        { nova: foto.value, remover: formData.get('remover_foto') === 'on' },
      ),
    );
    if (result.resultado === 'nao_encontrado') return { error: 'Espécie não encontrada.' };
    novoId = result.id;
  } catch (error) {
    return { error: duplicateMessage(error) ?? toUserMessage(error), fields };
  }

  revalidatePath('/cadastros/especies');
  if (!id) redirect(`/cadastros/especies/${novoId}?salvo=1`);
  revalidatePath(`/cadastros/especies/${id}`);
  return { success: 'Espécie salva.' };
}
