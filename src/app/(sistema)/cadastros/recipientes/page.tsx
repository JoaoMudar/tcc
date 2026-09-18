import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { can } from '@/lib/permissions';
import { listRecipientes } from '@/lib/recipientes';
import { requirePageAccess } from '@/lib/auth/guards';
import { NovoRecipienteForm } from './NovoRecipienteForm';
import { RecipienteForm } from './RecipienteForm';

/** F1 UC-08: o recipiente define o tamanho da muda (RF-11). */
export default async function RecipientesPage() {
  const user = await requirePageAccess('recipientes');
  const recipientes = await listRecipientes(pool);
  const podeEditar = can(user.perfil, 'recipientes', 'A');

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Recipientes" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {!podeEditar && <Notice tone="info">Os recipientes são da chefia. Seu perfil pode consultar, mas não alterar.</Notice>}

        {recipientes.map((recipiente) => (
          <RecipienteForm key={recipiente.id} recipiente={recipiente} podeEditar={podeEditar} />
        ))}
        {recipientes.length === 0 && <p className="text-base text-muted">Nenhum recipiente cadastrado.</p>}

        {can(user.perfil, 'recipientes', 'C') && (
          <>
            <h2 className="mt-6 text-sm font-bold tracking-widest text-muted uppercase">Novo recipiente</h2>
            <NovoRecipienteForm />
          </>
        )}
      </div>
    </main>
  );
}
