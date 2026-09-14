import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { CARACTERISTICA_LABELS, findEspecie, nomeExibido } from '@/lib/especies';
import { can } from '@/lib/permissions';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { EspecieForm } from '../EspecieForm';

export default async function EspeciePage({ params, searchParams }: PageProps<'/cadastros/especies/[id]'>) {
  const user = await requirePageAccess('especies');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const especie = await findEspecie(pool, id);
  if (!especie) notFound();
  const salvo = (await searchParams).salvo === '1';
  const podeEditar = can(user.perfil, 'especies', 'A');
  const caracteristicas = Object.entries(CARACTERISTICA_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <main>
      <PageHeader area="1 · Cadastros" title={nomeExibido(especie)} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros/especies" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {salvo && <Notice tone="success">Espécie cadastrada.</Notice>}
        {!podeEditar && <Notice tone="info">O catálogo de espécies é da chefia. Seu perfil pode consultar, mas não alterar.</Notice>}
        <EspecieForm especie={especie} caracteristicas={caracteristicas} podeEditar={podeEditar} />
      </div>
    </main>
  );
}
