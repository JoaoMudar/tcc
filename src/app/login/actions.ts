'use server';

import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { attemptLogin } from '@/lib/auth/login';
import { safeNextPath } from '@/lib/auth/route-rules';
import { requestOrigin, startSession } from '@/lib/auth/session';

/** RF-01. Única action pública: é ela que cria a sessão. */
export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const loginValue = formText(formData, 'login');
  const senha = formText(formData, 'senha');
  const fields = { login: loginValue };
  if (!loginValue.trim() || !senha) return { error: 'Preencha o usuário e a senha.', fields };

  let result;
  try {
    result = await attemptLogin(pool, {
      login: loginValue,
      senha,
      ...(await requestOrigin()),
      now: new Date(),
    });
    if (result.ok) await startSession(result.usuarioId);
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }

  if (!result.ok) return { error: result.message, fields };
  // redirect lança de propósito: fica fora do try
  redirect(result.deveTrocarSenha ? '/trocar-senha' : safeNextPath(formData.get('next')));
}
