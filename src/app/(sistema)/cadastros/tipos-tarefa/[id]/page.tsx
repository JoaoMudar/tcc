import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { can } from '@/lib/permissions';
import { CATEGORIA_TAREFA_LABELS, findTipoTarefa } from '@/lib/tipos-tarefa';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { TipoTarefaForm } from '../TipoTarefaForm';

export default async function TipoTarefaPage({ params, searchParams }: PageProps<'/cadastros/tipos-tarefa/[id]'>) {
  const user = await requirePageAccess('tipos_tarefa');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const tipo = await findTipoTarefa(pool, id);
  if (!tipo) notFound();
  const salvo = (await searchParams).salvo === '1';
  const podeEditar = can(user.perfil, 'tipos_tarefa', 'A');
  const categorias = Object.entries(CATEGORIA_TAREFA_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <main>
      <PageHeader area="1 · Cadastros" title={tipo.nome} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros/tipos-tarefa" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {salvo && <Notice tone="success">Tipo de tarefa cadastrado.</Notice>}
        {!podeEditar && (
          <Notice tone="info">Quem ajusta os tipos de tarefa é a gerência. Seu perfil pode consultar e criar tipo novo.</Notice>
        )}
        <TipoTarefaForm tipo={tipo} categorias={categorias} podeEditar={podeEditar} />
      </div>
    </main>
  );
}
