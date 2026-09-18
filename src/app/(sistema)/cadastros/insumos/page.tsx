import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { CATEGORIA_INSUMO_LABELS, UNIDADES_MEDIDA, listInsumos } from '@/lib/insumos';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';
import { InsumoForm } from './InsumoForm';
import { NovoInsumoForm } from './NovoInsumoForm';

/** F1 UC-09: o insumo é só catálogo, com categoria e unidade (RF-12). */
export default async function InsumosPage() {
  const user = await requirePageAccess('insumos');
  const insumos = await listInsumos(pool);
  const podeEditar = can(user.perfil, 'insumos', 'A');
  const categorias = Object.entries(CATEGORIA_INSUMO_LABELS).map(([value, label]) => ({ value, label }));
  const unidades = UNIDADES_MEDIDA.map((unidade) => ({ value: unidade, label: unidade }));

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Insumos" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {!podeEditar && <Notice tone="info">Os insumos são da chefia. Seu perfil pode consultar, mas não alterar.</Notice>}

        {insumos.map((insumo) => (
          <InsumoForm key={insumo.id} insumo={insumo} categorias={categorias} unidades={unidades} podeEditar={podeEditar} />
        ))}
        {insumos.length === 0 && <p className="text-base text-muted">Nenhum insumo cadastrado.</p>}

        {can(user.perfil, 'insumos', 'C') && (
          <>
            <h2 className="mt-6 text-sm font-bold tracking-widest text-muted uppercase">Novo insumo</h2>
            <NovoInsumoForm categorias={categorias} unidades={unidades} />
          </>
        )}
      </div>
    </main>
  );
}
