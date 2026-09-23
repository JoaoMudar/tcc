'use server';

import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { requireUser } from '@/lib/auth/dal';
import { isLocked, registerFailure } from '@/lib/auth/lockout';
import { OCUPADO } from '@/lib/auth/login';
import { comVagaDeVerificacao, hashPassword, validateNewPassword, verifyPassword } from '@/lib/auth/password';
import { endCurrentSession, requestOrigin } from '@/lib/auth/session';
import { deleteOtherSessions } from '@/lib/auth/session-store';
import { findUserForLogin, recordLoginEvent, saveFailure, updatePassword } from '@/lib/auth/user-store';

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

  let bloqueado = false;
  try {
    const conta = await findUserForLogin(pool, user.login);
    const agora = new Date();
    if (!conta || isLocked(conta.bloqueadoAte, agora)) {
      bloqueado = true;
    } else {
      const valida = await comVagaDeVerificacao(() => verifyPassword(atual, conta.senhaHash));
      if (valida === null) return { error: OCUPADO };
      if (!valida) {
        // Senha atual errada é tentativa de senha como qualquer outra: soma no bloqueio do login (SEC-011)
        const falha = registerFailure(conta.tentativas, agora);
        await saveFailure(pool, conta.id, falha.tentativas, falha.bloqueadoAte);
        await recordLoginEvent(pool, {
          usuarioId: conta.id,
          loginTentado: user.login.slice(0, 100),
          sucesso: false,
          ...(await requestOrigin()),
        });
        if (!falha.bloqueadoAte) return { error: 'A senha atual não confere.' };
        bloqueado = true;
      }
    }
    if (!bloqueado) {
      await updatePassword(pool, user.usuarioId, await hashPassword(nova), false);
      await deleteOtherSessions(pool, user.usuarioId, user.sessaoId);
    } else {
      await endCurrentSession();
    }
  } catch (error) {
    return { error: toUserMessage(error) };
  }

  // redirect lança de propósito: fica fora do try
  redirect(bloqueado ? '/login' : '/');
}
