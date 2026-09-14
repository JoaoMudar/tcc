import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { CARACTERISTICA_LABELS } from '@/lib/especies';
import { requirePageAccess } from '@/lib/auth/guards';
import { EspecieForm } from '../EspecieForm';

export default async function NovaEspeciePage() {
  await requirePageAccess('especies', 'C');
  const caracteristicas = Object.entries(CARACTERISTICA_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Nova espécie" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros/especies" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <EspecieForm caracteristicas={caracteristicas} podeEditar />
      </div>
    </main>
  );
}
