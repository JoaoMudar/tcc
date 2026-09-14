'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { formText } from '@/lib/form-state';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';
import { deleteOtherSessions, deleteUserSession } from '@/lib/auth/session-store';

/** RF-07: encerra à distância a sessão de outro aparelho do próprio usuário. */
export async function endSession(formData: FormData): Promise<void> {
  const user = await requirePermission('sessoes_proprias', 'E');
  const sessaoId = formText(formData, 'sessao_id');
  // A sessão atual se encerra por "Sair", não por aqui
  if (!isUuid(sessaoId) || sessaoId === user.sessaoId) return;
  await deleteUserSession(pool, user.usuarioId, sessaoId);
  revalidatePath('/conta/sessoes');
}

export async function endOtherSessions(): Promise<void> {
  const user = await requirePermission('sessoes_proprias', 'E');
  await deleteOtherSessions(pool, user.usuarioId, user.sessaoId);
  revalidatePath('/conta/sessoes');
}
