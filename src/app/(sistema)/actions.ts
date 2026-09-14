'use server';

import { redirect } from 'next/navigation';
import { endCurrentSession } from '@/lib/auth/session';

/** RF-03. Sem guard de propósito: encerrar sessão inexistente não faz mal. */
export async function logout(): Promise<void> {
  await endCurrentSession();
  redirect('/login');
}
