'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { adicionarNomePopular, criarEspecieRapida, duplicateMessage } from '@/lib/especies';
import type { EspecieRapidaState, NomePopularState } from '@/lib/especies-form';
import { formText } from '@/lib/form-state';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

/**
 * T8.16: as duas portas que o cadastro de pedido abre para o catálogo, sem sair
 * da tela. Ficam num arquivo próprio, e não em `actions.ts`, porque `actions.ts`
 * importa `readFotoFile` e o resto do formulário completo: quem cadastra pedido
 * não precisa carregar nada disso.
 */

/** A espécie que apareceu no meio de um pedido. Nome repetido reaproveita, não duplica. */
export async function criarEspecieRapidaAction(
  _previous: EspecieRapidaState,
  formData: FormData,
): Promise<EspecieRapidaState> {
  await requirePermission('especies', 'C');
  const fields = {
    nome_cientifico: formText(formData, 'nome_cientifico'),
    nome_popular: formText(formData, 'nome_popular'),
  };

  try {
    const resultado = await withTransaction(pool, (client) =>
      criarEspecieRapida(client, {
        nomeCientifico: fields.nome_cientifico,
        nomePopular: fields.nome_popular,
      }),
    );
    revalidatePath('/cadastros/especies');
    if ('existente' in resultado) {
      return { especie: resultado.existente, existente: resultado.existente, success: 'Essa espécie já estava cadastrada.' };
    }
    return { especie: resultado.criada, success: 'Espécie cadastrada.' };
  } catch (error) {
    return { error: duplicateMessage(error) ?? toUserMessage(error), fields };
  }
}

/** O nome que a pessoa corrigiu à mão vira sinônimo, e é reconhecido da próxima vez. */
export async function adicionarNomePopularAction(
  _previous: NomePopularState,
  formData: FormData,
): Promise<NomePopularState> {
  await requirePermission('especies', 'A');
  const especieId = formText(formData, 'especie_id');
  const nome = formText(formData, 'nome');
  if (!isUuid(especieId)) return { error: 'Espécie inválida.' };

  try {
    const salvo = await withTransaction(pool, (client) => adicionarNomePopular(client, especieId, nome));
    revalidatePath('/cadastros/especies');
    revalidatePath(`/cadastros/especies/${especieId}`);
    return { nomeSalvo: { especieId, nome: salvo }, success: `"${salvo}" salvo como outro nome.` };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
