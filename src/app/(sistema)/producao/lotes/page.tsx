import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { listAreas } from '@/lib/areas';
import pool from '@/lib/db';
import { FASES, formatQuantidade } from '@/lib/lotes-rotulos';
import { listLotesAbertos, montarOcupacao } from '@/lib/lotes';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';

/** T4.3, RF-33: o viveiro por área e canteiro, com os lotes de cada canteiro e os livres à vista. */
export default async function OcupacaoPage() {
  const user = await requirePageAccess('lotes');
  const [areas, lotes] = await Promise.all([listAreas(pool), listLotesAbertos(pool)]);
  const ocupacao = montarOcupacao(areas, lotes);
  const livres = ocupacao.reduce((soma, area) => soma + area.livres, 0);

  return (
    <main>
      <PageHeader area="2 · Produção" title="Lotes" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        <Link href="/producao" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <p className="text-base text-muted">
          {lotes.length} {lotes.length === 1 ? 'lote aberto' : 'lotes abertos'} · {livres}{' '}
          {livres === 1 ? 'canteiro livre' : 'canteiros livres'}
        </p>
        {can(user.perfil, 'lotes', 'C') && (
          <Link
            href="/producao/lotes/novo"
            className="flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark"
          >
            Novo lote
          </Link>
        )}

        {ocupacao.map((area) => (
          <section key={area.id} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">
                Área {area.letra}
                {area.nome && <span className="font-normal text-muted"> · {area.nome}</span>}
              </h2>
              <span className="text-sm text-muted">
                {area.livres} de {area.canteiros.length} livres
              </span>
            </div>
            {area.canteiros.length === 0 && <p className="text-base text-muted">Nenhum canteiro cadastrado.</p>}
            <ul className="flex flex-col gap-2">
              {area.canteiros.map((canteiro) => (
                <li key={canteiro.id} className="rounded-lg border border-line">
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-base font-semibold text-ink">
                      {area.letra}-{canteiro.numero}
                    </span>
                    {canteiro.livre ? (
                      <Pill tone="green">livre</Pill>
                    ) : (
                      <span className="text-sm text-muted">
                        {formatQuantidade(canteiro.mudas)}
                        {canteiro.capacidade !== null && ` de ${formatQuantidade(canteiro.capacidade)}`} mudas
                      </span>
                    )}
                  </div>
                  {canteiro.lotes.length > 0 && (
                    <ul className="border-t border-line">
                      {canteiro.lotes.map((lote) => (
                        <li key={lote.id}>
                          <Link
                            href={`/producao/lotes/${lote.id}`}
                            className="flex min-h-touch items-center justify-between gap-3 px-3 py-2 active:bg-brand-light"
                          >
                            <span className="flex flex-col">
                              <span className="text-base font-semibold text-ink">
                                {lote.codigo} · {lote.especie}
                              </span>
                              <span className="text-sm text-muted">{lote.recipiente}</span>
                            </span>
                            <span className="flex flex-col items-end gap-1">
                              <span className="text-base font-bold text-ink">{formatQuantidade(lote.saldo)}</span>
                              <Pill tone={lote.fase === 'pronto' ? 'green' : 'neutral'}>{FASES[lote.fase]}</Pill>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {ocupacao.length === 0 && (
          <p className="text-base text-muted">
            Nenhuma área cadastrada.{' '}
            <Link href="/cadastros/areas" className="font-semibold text-brand-dark underline">
              Cadastrar áreas e canteiros
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
