'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { duplicateMessage, parseEspecieFields, saveEspecie } from '@/lib/especies';
import { type ResultadoBusca, buscarNomes, conferirNomeNaFfb } from '@/lib/especies-ffb';
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

  // RF-68: o que a pessoa tocou na busca. Só dígitos: é o taxonID da FFB
  const taxonId = formText(formData, 'taxon_id_ffb');
  const sinonimoTaxonId = formText(formData, 'sinonimo_taxon_id_ffb');
  if (!/^\d*$/.test(taxonId) || !/^\d*$/.test(sinonimoTaxonId)) return { error: 'Escolha inválida na busca.', fields };

  const foto = await readFotoFile(formData.get('foto'));
  if ('error' in foto) return { error: foto.error, fields };

  let novoId: string;
  try {
    const result = await withTransaction(pool, async (client) => {
      const salva = await saveEspecie(
        client,
        id || null,
        { ...parsed.value, ativa: id ? formData.get('ativa') === 'on' : true },
        { nova: foto.value, remover: formData.get('remover_foto') === 'on' },
      );
      // RN-68: conferir o nome não bloqueia; o que não bate fica pendente para a chefia
      if (salva.resultado === 'ok') {
        await conferirNomeNaFfb(client, salva.id, { taxonId: taxonId || null, sinonimoTaxonId: sinonimoTaxonId || null });
      }
      return salva;
    });
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

/** RF-68: a busca do cadastro, no que o viveiro já tem e na cópia local da FFB. */
export async function buscarNomesEspecieAction(termo: string): Promise<ResultadoBusca> {
  await requirePermission('especies', 'C');
  if (typeof termo !== 'string' || termo.length > 80) return { doViveiro: [], daFlora: [] };
  return buscarNomes(pool, termo);
}
