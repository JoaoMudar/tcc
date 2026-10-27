'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { reconferirEspecies } from '@/lib/especies-ffb';
import type { FormState } from '@/lib/form-state';
import { withTransaction } from '@/lib/transaction';
import { requirePermission } from '@/lib/auth/guards';

export interface ReconferenciaState extends FormState {
  pendentes?: string[];
}

/** RF-13: reconfere as espécies cadastradas contra a cópia importada. Só o administrador (D4). */
export async function reconferirEspeciesAction(): Promise<ReconferenciaState> {
  await requirePermission('referencia_ffb', 'A');
  try {
    const resultado = await withTransaction(pool, (client) => reconferirEspecies(client));
    revalidatePath('/cadastros/especies');
    revalidatePath('/admin/ffb');
    const pendentes = resultado.pendentes.map((p) => p.nome);
    return {
      success:
        `Versão ${resultado.versao}: ${resultado.reconferidas} espécie(s) continuam com nome aceito` +
        (pendentes.length > 0 ? `, e ${pendentes.length} voltaram a pendentes, com o nome mantido.` : '.'),
      pendentes,
    };
  } catch (error) {
    return { error: toUserMessage(error) };
  }
}
