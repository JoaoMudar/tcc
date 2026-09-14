import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { listAreas } from '@/lib/areas';
import pool from '@/lib/db';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';
import { ExcluirAreaForm } from './ExcluirAreaForm';
import { ExcluirCanteiroForm } from './ExcluirCanteiroForm';
import { NovaAreaForm } from './NovaAreaForm';
import { NovoCanteiroForm } from './NovoCanteiroForm';

/** F1 UC-16: área por letra e canteiro por número, como a equipe já fala no viveiro (RF-13). */
export default async function AreasPage() {
  const user = await requirePageAccess('areas_canteiros');
  const areas = await listAreas(pool);
  const podeCriar = can(user.perfil, 'areas_canteiros', 'C');
  const podeExcluir = can(user.perfil, 'areas_canteiros', 'E');

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Áreas e canteiros" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {!podeCriar && <Notice tone="info">Áreas e canteiros são da gerência. Seu perfil pode consultar.</Notice>}

        {areas.map((area) => (
          <section key={area.id} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">
                Área {area.letra}
                {area.nome && <span className="font-normal text-muted"> · {area.nome}</span>}
              </h2>
              <span className="text-sm text-muted">
                {area.canteiros.length} {area.canteiros.length === 1 ? 'canteiro' : 'canteiros'}
              </span>
            </div>
            {area.canteiros.length > 0 && (
              <ul className="grid grid-cols-6 gap-1.5" aria-label={`Canteiros da área ${area.letra}`}>
                {area.canteiros.map((canteiro) => (
                  <li
                    key={canteiro.id}
                    title={canteiro.capacidade ? `Capacidade: ${canteiro.capacidade} mudas` : undefined}
                    className="flex h-10 items-center justify-center rounded-md bg-brand-light text-base font-semibold text-brand-dark"
                  >
                    {canteiro.numero}
                  </li>
                ))}
              </ul>
            )}
            {podeCriar && <NovoCanteiroForm areaId={area.id} letra={area.letra} />}
            {podeExcluir && area.canteiros.length > 0 && <ExcluirCanteiroForm canteiros={area.canteiros} />}
            {podeExcluir && area.canteiros.length === 0 && <ExcluirAreaForm areaId={area.id} letra={area.letra} />}
          </section>
        ))}
        {areas.length === 0 && <p className="text-base text-muted">Nenhuma área cadastrada.</p>}

        {podeCriar && (
          <>
            <h2 className="mt-6 text-sm font-bold tracking-widest text-muted uppercase">Nova área</h2>
            <NovaAreaForm />
          </>
        )}
      </div>
    </main>
  );
}
