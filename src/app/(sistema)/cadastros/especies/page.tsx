import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { SearchForm } from '@/components/ui/SearchForm';
import pool from '@/lib/db';
import { CARACTERISTICA_LABELS, nomeExibido, searchEspecies } from '@/lib/especies';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';

/** F1 UC-07: a busca aceita qualquer nome, porque no viveiro ninguém procura por Cedrela fissilis (RF-10). */
export default async function EspeciesPage({ searchParams }: PageProps<'/cadastros/especies'>) {
  const user = await requirePageAccess('especies');
  const params = await searchParams;
  const busca = typeof params.busca === 'string' ? params.busca.slice(0, 80) : '';
  const especies = await searchEspecies(pool, busca);

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Espécies" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        <Link href="/cadastros" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <SearchForm label="Buscar por qualquer nome" defaultValue={busca} />

        {especies.map((especie) => (
          <Link
            key={especie.id}
            href={`/cadastros/especies/${especie.id}`}
            className={`flex items-center gap-3 rounded-xl border border-line bg-white p-3 active:bg-brand-light ${
              especie.ativa ? '' : 'opacity-60'
            }`}
          >
            {especie.fotoUrl ? (
              // A foto vem da própria API, já reduzida: o otimizador de imagem do Next não acrescenta nada
              // eslint-disable-next-line @next/next/no-img-element
              <img src={especie.fotoUrl} alt="" className="size-14 flex-none rounded-lg object-cover" />
            ) : (
              <span className="flex size-14 flex-none items-center justify-center rounded-lg bg-gray-100 text-xs text-muted">
                sem foto
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold text-ink">{nomeExibido(especie)}</span>
              {especie.nomesPopulares.length > 0 && <span className="text-sm text-muted italic">{especie.nomeCientifico}</span>}
              {especie.caracteristicas.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {especie.caracteristicas.map((c) => (
                    <Pill key={c} tone={c === 'nativa' ? 'green' : 'neutral'}>
                      {CARACTERISTICA_LABELS[c]}
                    </Pill>
                  ))}
                </span>
              )}
              {especie.nomesPopulares.length > 1 && (
                <span className="text-sm text-muted">Também: {especie.nomesPopulares.slice(1).join(', ')}</span>
              )}
              {!especie.ativa && <span className="text-sm text-muted">fora de uso</span>}
            </span>
          </Link>
        ))}
        {especies.length === 0 && <p className="text-base text-muted">Nenhuma espécie encontrada.</p>}

        {can(user.perfil, 'especies', 'C') && (
          <Link
            href="/cadastros/especies/nova"
            className="mt-2 inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark"
          >
            + Nova espécie
          </Link>
        )}
      </div>
    </main>
  );
}
