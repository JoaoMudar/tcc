import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Pill } from '@/components/ui/Pill';
import pool from '@/lib/db';
import { can } from '@/lib/permissions';
import { CATEGORIA_TAREFA_LABELS, type CategoriaTarefa, listTiposTarefa, resumoDeclaracoes } from '@/lib/tipos-tarefa';
import { requirePageAccess } from '@/lib/auth/guards';

/** F1 UC-15: o catálogo que decide o formulário da agenda (RF-21). */
export default async function TiposTarefaPage() {
  const user = await requirePageAccess('tipos_tarefa');
  const tipos = await listTiposTarefa(pool);
  const categorias = Object.keys(CATEGORIA_TAREFA_LABELS) as CategoriaTarefa[];

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Tipos de tarefa" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        <Link href="/cadastros" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>

        {categorias.map((categoria) => {
          const daCategoria = tipos.filter((tipo) => tipo.categoria === categoria);
          if (daCategoria.length === 0) return null;
          return (
            <section key={categoria} className="flex flex-col gap-2">
              <h2 className="mt-3 text-sm font-bold tracking-widest text-muted uppercase">{CATEGORIA_TAREFA_LABELS[categoria]}</h2>
              {daCategoria.map((tipo) => (
                <Link
                  key={tipo.id}
                  href={`/cadastros/tipos-tarefa/${tipo.id}`}
                  className={`flex flex-col gap-1 rounded-xl border border-line bg-white p-4 active:bg-brand-light ${
                    tipo.ativo ? '' : 'opacity-60'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-ink">{tipo.nome}</span>
                    {!tipo.ativo && <Pill tone="neutral">fora de uso</Pill>}
                  </span>
                  <span className="text-sm text-muted">{resumoDeclaracoes(tipo)}</span>
                </Link>
              ))}
            </section>
          );
        })}
        {tipos.length === 0 && <p className="text-base text-muted">Nenhum tipo de tarefa cadastrado.</p>}

        {can(user.perfil, 'tipos_tarefa', 'C') && (
          <Link
            href="/cadastros/tipos-tarefa/novo"
            className="mt-2 inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark"
          >
            + Novo tipo de tarefa
          </Link>
        )}
      </div>
    </main>
  );
}
