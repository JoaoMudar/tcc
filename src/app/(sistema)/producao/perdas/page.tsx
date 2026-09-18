import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { formatData, hojeNoViveiro } from '@/lib/datas';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { CAUSAS_PERDA, formatQuantidade } from '@/lib/lotes-rotulos';
import {
  acimaDoLimite,
  formatPercentual,
  limiteMortalidade,
  listMortalidadeLotes,
  listPerdas,
  parseFiltroPerdas,
  totaisPorCausa,
} from '@/lib/perdas';
import { requirePageAccess } from '@/lib/auth/guards';

interface PerdasPageProps {
  searchParams: Promise<{ de?: string; ate?: string; especie?: string; causa?: string }>;
}

const CAUSA_OPCOES = Object.entries(CAUSAS_PERDA).map(([value, label]) => ({ value, label }));

/** F1 UC-30, T4.11: perdas por período, espécie e causa (RF-41), e a mortalidade de cada lote (RF-42). */
export default async function PerdasPage({ searchParams }: PerdasPageProps) {
  await requirePageAccess('analise_perdas');
  const filtro = parseFiltroPerdas(await searchParams, hojeNoViveiro());
  const [perdas, lotes, limite, especies] = await Promise.all([
    listPerdas(pool, filtro),
    listMortalidadeLotes(pool, filtro),
    limiteMortalidade(pool),
    searchEspecies(pool),
  ]);
  const total = perdas.reduce((soma, perda) => soma + perda.quantidade, 0);
  const causas = totaisPorCausa(perdas);
  const acima = lotes.filter((lote) => acimaDoLimite(lote.taxa, limite)).length;

  return (
    <main>
      <PageHeader area="2 · Produção" title="Perdas" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        <Link href="/producao" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>

        <form method="get" className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="De" name="de" type="date" defaultValue={filtro.de} />
            <TextField label="Até" name="ate" type="date" defaultValue={filtro.ate} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Espécie"
              name="especie"
              placeholder="Todas"
              options={[{ value: '', label: 'Todas' }, ...especies.map((e) => ({ value: e.id, label: nomeExibido(e) }))]}
              defaultValue={filtro.especieId ?? ''}
            />
            <SelectField
              label="Causa"
              name="causa"
              placeholder="Todas"
              options={[{ value: '', label: 'Todas' }, ...CAUSA_OPCOES]}
              defaultValue={filtro.causa ?? ''}
            />
          </div>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-sm text-muted">Perdidas</p>
            <p className="text-2xl font-bold text-ink">{formatQuantidade(total)}</p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-sm text-muted">Lotes acima de {limite}%</p>
            <p className={`text-2xl font-bold ${acima > 0 ? 'text-red-800' : 'text-ink'}`}>{acima}</p>
          </div>
        </div>
        <p className="text-sm text-muted">
          De {formatData(filtro.de)} a {formatData(filtro.ate)}. A mortalidade é do lote inteiro: todas as perdas dele sobre a quantidade
          inicial.
        </p>

        {causas.length > 0 && (
          <section className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
            <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Por causa</h2>
            {causas.map(({ causa, quantidade }) => (
              <div key={causa} className="flex flex-col gap-1">
                <div className="flex justify-between text-base">
                  <span className="text-ink">{CAUSAS_PERDA[causa]}</span>
                  <span className="font-semibold text-ink">{formatQuantidade(quantidade)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${(quantidade / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>
        )}

        <h2 className="mt-2 text-sm font-bold tracking-widest text-muted uppercase">Mortalidade por lote</h2>
        {lotes.length === 0 ? (
          <p className="text-base text-muted">Nenhuma perda no filtro escolhido.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
            {lotes.map((lote) => {
              const destaque = acimaDoLimite(lote.taxa, limite);
              return (
                <li key={lote.id}>
                  <Link
                    href={`/producao/lotes/${lote.id}`}
                    className="flex min-h-touch items-center justify-between gap-3 px-4 py-3 active:bg-brand-light"
                  >
                    <span className="flex flex-col">
                      <span className="text-base font-semibold text-ink">
                        {lote.codigo} · {lote.especie}
                      </span>
                      <span className="text-sm text-muted">
                        {lote.recipiente} · {formatQuantidade(lote.perdas)} de {formatQuantidade(lote.quantidadeInicial)}
                        {lote.encerrado && ' · encerrado'}
                      </span>
                    </span>
                    <span className={`text-lg font-bold ${destaque ? 'text-red-800' : 'text-ink'}`}>
                      {lote.taxa === null ? '-' : formatPercentual(lote.taxa)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <h2 className="mt-2 text-sm font-bold tracking-widest text-muted uppercase">Registros</h2>
        {perdas.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
            {perdas.map((perda) => (
              <li key={perda.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="flex flex-col">
                  <span className="text-base text-ink">
                    {formatData(perda.data)} · {perda.codigo} · {perda.especie}
                  </span>
                  <span className="text-sm text-muted">
                    {CAUSAS_PERDA[perda.causa]}
                    {perda.observacoes && ` · ${perda.observacoes}`}
                  </span>
                </span>
                <span className="text-base font-bold text-red-800">{formatQuantidade(perda.quantidade)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
