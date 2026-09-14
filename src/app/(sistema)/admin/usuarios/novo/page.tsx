import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import pool from '@/lib/db';
import { listPessoasDisponiveis } from '@/lib/usuarios';
import { requirePageAccess } from '@/lib/auth/guards';
import { CreateUserForm } from './CreateUserForm';

export default async function NovoUsuarioPage() {
  await requirePageAccess('usuarios', 'C');
  const pessoas = await listPessoasDisponiveis(pool, null);

  return (
    <main>
      <PageHeader area="Administração" title="Novo usuário" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/admin/usuarios" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <CreateUserForm pessoas={pessoas} />
      </div>
    </main>
  );
}
