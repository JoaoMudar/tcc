'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import {
  duplicateMessage,
  findUsuario,
  insertUsuario,
  parseUsuarioFields,
  saveUsuarioChanges,
  validateLogin,
} from '@/lib/usuarios';
import { requirePermission } from '@/lib/auth/guards';
import { normalizeLogin } from '@/lib/auth/login';
import { hashPassword, validateNewPassword } from '@/lib/auth/password';
import { deleteOtherSessions } from '@/lib/auth/session-store';
import { updatePassword } from '@/lib/auth/user-store';

/** RF-05: o admin cria o usuário, com perfil e senha provisória. */
export async function createUser(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission('usuarios', 'C');
  const fields = {
    nome_exibicao: formText(formData, 'nome_exibicao'),
    login: normalizeLogin(formText(formData, 'login')),
    perfil: formText(formData, 'perfil'),
    pessoa_id: formText(formData, 'pessoa_id'),
  };

  const loginProblem = validateLogin(fields.login);
  if (loginProblem) return { error: loginProblem, fields };
  const parsed = parseUsuarioFields({
    nomeExibicao: fields.nome_exibicao,
    perfil: fields.perfil,
    pessoaId: fields.pessoa_id,
  });
  if ('error' in parsed) return { error: parsed.error, fields };
  const senha = formText(formData, 'senha_provisoria');
  const senhaProblem = validateNewPassword(senha, { login: fields.login, nome: parsed.value.nomeExibicao });
  if (senhaProblem) return { error: senhaProblem, fields };

  let id: string;
  try {
    id = await insertUsuario(pool, { ...parsed.value, login: fields.login, senhaHash: await hashPassword(senha) });
  } catch (error) {
    return { error: duplicateMessage(error) ?? toUserMessage(error), fields };
  }

  revalidatePath('/admin/usuarios');
  redirect(`/admin/usuarios/${id}?criado=1`);
}

/** RF-05: nome, perfil, vínculo com pessoa e ativação. */
export async function updateUser(_previous: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission('usuarios', 'A');
  const id = formText(formData, 'usuario_id');
  if (!isUuid(id)) return { error: 'Usuário inválido.' };

  const parsed = parseUsuarioFields({
    nomeExibicao: formText(formData, 'nome_exibicao'),
    perfil: formText(formData, 'perfil'),
    pessoaId: formText(formData, 'pessoa_id'),
  });
  if ('error' in parsed) return { error: parsed.error };
  const ativo = formData.get('ativo') === 'on';
  if (!ativo && id === admin.usuarioId) return { error: 'Você não pode desativar o próprio usuário.' };

  try {
    const result = await withTransaction(pool, (client) => saveUsuarioChanges(client, id, { ...parsed.value, ativo }));
    if (result === 'nao_encontrado') return { error: 'Usuário não encontrado.' };
    if (result === 'ultimo_admin') return { error: 'Precisa sobrar pelo menos um administrador ativo.' };
  } catch (error) {
    return { error: duplicateMessage(error) ?? toUserMessage(error) };
  }

  revalidatePath('/admin/usuarios');
  revalidatePath(`/admin/usuarios/${id}`);
  return { success: ativo ? 'Alterações salvas.' : 'Alterações salvas. O usuário foi desconectado de todos os aparelhos.' };
}

/** Senha esquecida: o admin define uma provisória, e a pessoa troca na próxima entrada. */
export async function resetPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePermission('usuarios', 'A');
  const id = formText(formData, 'usuario_id');
  if (!isUuid(id)) return { error: 'Usuário inválido.' };
  const senha = formText(formData, 'senha_provisoria');

  try {
    const usuario = await findUsuario(pool, id);
    if (!usuario) return { error: 'Usuário não encontrado.' };
    const problem = validateNewPassword(senha, { login: usuario.login, nome: usuario.nomeExibicao });
    if (problem) return { error: problem };
    await updatePassword(pool, id, await hashPassword(senha), true);
    // Os aparelhos da pessoa perdem o acesso; o do próprio admin, se for ele, continua
    await deleteOtherSessions(pool, id, id === admin.usuarioId ? admin.sessaoId : null);
  } catch (error) {
    return { error: toUserMessage(error) };
  }

  revalidatePath(`/admin/usuarios/${id}`);
  return { success: 'Senha provisória definida. Na próxima entrada, a pessoa vai trocar por uma dela.' };
}
