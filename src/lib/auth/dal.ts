import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentSession } from './session';
import type { SessionUser } from './session-store';

/**
 * Exige sessão válida (RF-01). Quem ainda está com a senha provisória vai
 * para a troca antes de qualquer outra tela (RF-02).
 */
export async function requireUser(options: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.deveTrocarSenha && !options.allowPasswordChange) redirect('/trocar-senha');
  return session;
}
