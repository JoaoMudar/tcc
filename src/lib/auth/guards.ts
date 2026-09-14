import 'server-only';
import { redirect } from 'next/navigation';
import { UserError } from '@/lib/errors';
import { type Operacao, type Recurso, can } from '@/lib/permissions';
import { requireUser } from './dal';
import type { SessionUser } from './session-store';

export const FORBIDDEN_MESSAGE = 'Seu perfil não permite esta operação.';

/**
 * Guard de toda Server Action (RF-06, RNF-11): sessão e permissão verificadas
 * no servidor, a cada operação, sem confiar no que a interface escondeu.
 */
export async function requirePermission(recurso: Recurso, operacao: Operacao): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.perfil, recurso, operacao)) throw new UserError(FORBIDDEN_MESSAGE);
  return user;
}

/** Guard de página: endereço digitado sem permissão cai numa tela que explica (D4 §4). */
export async function requirePageAccess(recurso: Recurso, operacao: Operacao = 'L'): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.perfil, recurso, operacao)) redirect('/sem-permissao');
  return user;
}
