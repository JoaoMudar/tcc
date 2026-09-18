import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { CATEGORIA_TAREFA_LABELS } from '@/lib/tipos-tarefa';
import { requirePageAccess } from '@/lib/auth/guards';
import { TipoTarefaForm } from '../TipoTarefaForm';

export default async function NovoTipoTarefaPage() {
  await requirePageAccess('tipos_tarefa', 'C');
  const categorias = Object.entries(CATEGORIA_TAREFA_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Novo tipo de tarefa" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros/tipos-tarefa" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <TipoTarefaForm categorias={categorias} podeEditar />
      </div>
    </main>
  );
}
