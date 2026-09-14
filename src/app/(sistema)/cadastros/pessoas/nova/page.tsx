import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';
import { PessoaForm } from '../PessoaForm';

export default async function NovaPessoaPage() {
  const user = await requirePageAccess('pessoas', 'C');

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Nova pessoa" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros/pessoas" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <PessoaForm verFiscal={can(user.perfil, 'dados_fiscais', 'C')} podeEditar />
      </div>
    </main>
  );
}
