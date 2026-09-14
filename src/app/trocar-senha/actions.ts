'use server';

import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { requireUser } from '@/lib/auth/dal';
import { hashPassword, validateNewPassword, verifyPassword } from '@/lib/auth/password';
import { deleteOtherSessions } from '@/lib/auth/session-store';
import { findPasswordHash, updatePassword } from '@/lib/auth/user-store';

/** RF-02: troca da senha, obrigatória no primeiro acesso. Encerra as outras sessões. */
export async function changePassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });
  const atual = formText(formData, 'senha_atual');
  const nova = formText(formData, 'nova_senha');
  const repetida = formText(formData, 'repetir_senha');

  if (!atual || !nova || !repetida) return { error: 'Preencha os três campos.' };
  if (nova !== repetida) return { error: 'A nova senha e a repetição não são iguais.' };
  if (nova === atual) return { error: 'A nova senha precisa ser diferente da atual.' };
  const problem = validateNewPassword(nova, { login: user.login, nome: user.nomeExibicao });
  if (problem) return { error: problem };

  try {
    const stored = await findPasswordHash(pool, user.usuarioId);
    if (!stored || !(await verifyPassword(atual, stored))) return { error: 'A senha atual não confere.' };
    await updatePassword(pool, user.usuarioId, await hashPassword(nova), false);
    await deleteOtherSessions(pool, user.usuarioId, user.sessaoId);
  } catch (error) {
    return { error: toUserMessage(error) };
  }

  redirect('/');
}
