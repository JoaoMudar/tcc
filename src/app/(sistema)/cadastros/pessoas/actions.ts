'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { validateTelefone } from '@/lib/documento';
import { toUserMessage } from '@/lib/errors';
import { formText } from '@/lib/form-state';
import * as pessoas from '@/lib/pessoas';
import type { ClienteRapidoState, PessoaFormState } from '@/lib/pessoas';
import { withTransaction } from '@/lib/transaction';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

function textFields(formData: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === 'string' && !name.startsWith('$')) fields[name] = value;
  }
  return fields;
}

/**
 * RF-14, RF-16, RF-19, RF-20. O bloco fiscal só é lido quando o formulário o
 * declara (`inclui_fiscal`), e aí passa por um guard próprio: a gerência que
 * forjar o campo é recusada antes de o banco ser consultado (D4 §3.1).
 */
export async function savePessoaAction(_previous: PessoaFormState, formData: FormData): Promise<PessoaFormState> {
  const id = formText(formData, 'pessoa_id');
  const operacao = id ? 'A' : 'C';
  await requirePermission('pessoas', operacao);
  const incluiFiscal = formData.get('inclui_fiscal') === '1';
  if (incluiFiscal) await requirePermission('dados_fiscais', operacao);
  if (id && !isUuid(id)) return { error: 'Pessoa inválida.' };

  const fields = textFields(formData);
  const get = (name: string) => fields[name] ?? '';
  const parsed = pessoas.parsePessoaFields(get);
  if ('error' in parsed) return { error: parsed.error, fields };
  const fiscal = incluiFiscal ? pessoas.parseFiscalFields(parsed.value.tipo, get) : null;
  if (fiscal && 'error' in fiscal) return { error: fiscal.error, fields };

  let pessoaId: string;
  try {
    // RF-14: procurar quem já existe antes de criar outra
    if (fiscal?.value.documento) {
      const dona = await pessoas.findPessoaPorDocumento(pool, fiscal.value.documento, id || null);
      if (dona) return { error: `${dona.nome} já está cadastrada com esse documento.`, existente: dona, fields };
    }
    if (!id && parsed.value.telefone && formData.get('confirmar_novo') !== '1') {
      const candidatas = await pessoas.findPessoasPorTelefone(pool, parsed.value.telefone);
      if (candidatas.length > 0) return { candidatas, fields };
    }

    const result = await withTransaction(pool, (client) =>
      pessoas.savePessoa(client, id || null, parsed.value, fiscal?.value ?? null),
    );
    if (result.resultado === 'nao_encontrado') return { error: 'Pessoa não encontrada.' };
    pessoaId = result.id;
  } catch (error) {
    return { error: pessoas.duplicateMessage(error) ?? toUserMessage(error), fields };
  }

  revalidatePath('/cadastros/pessoas');
  if (!id) redirect(`/cadastros/pessoas/${pessoaId}?salvo=1`);
  revalidatePath(`/cadastros/pessoas/${id}`);
  return { success: 'Cadastro salvo.' };
}

/**
 * RF-15: nome e telefone, sem sair da tela de onde foi chamado. Telefone já
 * cadastrado não cria outra pessoa sem que quem cadastra escolha.
 */
export async function createClienteRapido(_previous: ClienteRapidoState, formData: FormData): Promise<ClienteRapidoState> {
  await requirePermission('pessoas', 'C');
  const fields = { nome: formText(formData, 'nome'), telefone: formText(formData, 'telefone') };

  const usarId = formText(formData, 'usar_pessoa_id');
  if (usarId) {
    if (!isUuid(usarId)) return { error: 'Pessoa inválida.', fields };
    try {
      const nome = await pessoas.addPapel(pool, usarId, 'cliente');
      if (!nome) return { error: 'Pessoa não encontrada.', fields };
      revalidatePath('/cadastros/pessoas');
      return { success: `${nome} agora também é cliente.`, cliente: { id: usarId, nome } };
    } catch (error) {
      return { error: toUserMessage(error), fields };
    }
  }

  const nome = fields.nome.trim().replace(/\s+/g, ' ');
  if (nome.length < 2 || nome.length > 120) return { error: 'O nome precisa ter de 2 a 120 caracteres.', fields };
  const telefone = validateTelefone(fields.telefone);
  if ('error' in telefone) return { error: telefone.error, fields };
  if (!telefone.value) return { error: 'Informe o telefone do cliente.', fields };

  try {
    if (formData.get('confirmar_novo') !== '1') {
      const candidatas = await pessoas.findPessoasPorTelefone(pool, telefone.value);
      if (candidatas.length > 0) return { candidatas, fields };
    }
    const id = await withTransaction(pool, (client) =>
      pessoas.insertClienteRapido(client, { nome, telefone: telefone.value }),
    );
    revalidatePath('/cadastros/pessoas');
    return { success: `Cliente ${nome} cadastrado.`, cliente: { id, nome } };
  } catch (error) {
    return { error: toUserMessage(error), fields };
  }
}
