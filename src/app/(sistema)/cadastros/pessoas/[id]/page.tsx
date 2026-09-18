import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { findPessoa, papeisResumo } from '@/lib/pessoas';
import { can } from '@/lib/permissions';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { PessoaForm } from '../PessoaForm';

/** F1 UC-11: a ficha completa. Sem permissão fiscal, o documento nem sai do banco (D4 §3.1). */
export default async function PessoaPage({ params, searchParams }: PageProps<'/cadastros/pessoas/[id]'>) {
  const user = await requirePageAccess('pessoas');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const verFiscal = can(user.perfil, 'dados_fiscais', 'L');
  const pessoa = await findPessoa(pool, id, verFiscal);
  if (!pessoa) notFound();
  const salvo = (await searchParams).salvo === '1';
  const podeEditar = can(user.perfil, 'pessoas', 'A');

  return (
    <main>
      <PageHeader area="1 · Cadastros" title={pessoa.nome} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros/pessoas" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <p className="text-base text-gray-700">
          {papeisResumo(pessoa.papeis) || 'Sem papel ativo'}
          {pessoa.papeis.some((p) => p.papel === 'funcionario') && (pessoa.temAcesso ? ' · acessa o sistema' : ' · sem acesso')}
        </p>
        {salvo && <Notice tone="success">Cadastro criado.</Notice>}
        {!podeEditar && (
          <Notice tone="info">Seu perfil vê nome, telefone e papéis. O cadastro e os dados fiscais ficam com a chefia.</Notice>
        )}
        {verFiscal && pessoa.papeis.some((p) => p.papel === 'cliente') && !pessoa.documento && (
          <Notice tone="warning">Cadastro fiscal incompleto: falta o {pessoa.tipo === 'pf' ? 'CPF' : 'CNPJ'}.</Notice>
        )}
        <PessoaForm pessoa={pessoa} verFiscal={verFiscal && podeEditar} podeEditar={podeEditar} />
      </div>
    </main>
  );
}
