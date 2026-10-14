'use server';

import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { formText } from '@/lib/form-state';
import { isUuid } from '@/lib/uuid';
import { parseInscricao, removerInscricao, salvarInscricao } from '@/lib/notificacoes';
import { requireUser } from '@/lib/auth/dal';
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

/**
 * Inscreve este aparelho para o aviso do pedido que muda de mão. Chamada também
 * ao abrir a tela com o aviso já ligado: se outra pessoa entrou no mesmo
 * celular, a inscrição passa para ela.
 */
export async function inscreverAparelhoAction(inscricao: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const valida = parseInscricao(inscricao);
  if (!valida) return { ok: false };
  await salvarInscricao(pool, user.usuarioId, valida);
  return { ok: true };
}

export async function desinscreverAparelhoAction(endpoint: string): Promise<void> {
  const user = await requireUser();
  if (typeof endpoint !== 'string' || !endpoint) return;
  await removerInscricao(pool, user.usuarioId, endpoint);
}
