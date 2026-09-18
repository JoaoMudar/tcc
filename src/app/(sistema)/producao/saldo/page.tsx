import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import pool from '@/lib/db';
import { saldoPronto } from '@/lib/estoque';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { requirePageAccess } from '@/lib/auth/guards';

/** T4.10, RF-43, UC-29: muda pronta por espécie e recipiente, somada dos lotes. */
export default async function SaldoProntoPage() {
  await requirePageAccess('estoque_disponivel');
  const saldos = await saldoPronto(pool);

  const porEspecie = new Map<string, typeof saldos>();
  for (const saldo of saldos) porEspecie.set(saldo.especieId, [...(porEspecie.get(saldo.especieId) ?? []), saldo]);

  return (
    <main>
      <PageHeader area="2 · Produção" title="Muda pronta" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/producao" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <p className="text-base text-muted">
          Soma dos lotes abertos na fase pronto. Perda e venda já estão descontadas do saldo de cada lote.
        </p>
        {saldos.length === 0 && <p className="text-base text-muted">Nenhum lote pronto no momento.</p>}
        {[...porEspecie.values()].map((linhas) => (
          <section key={linhas[0].especieId} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
            <h2 className="text-lg font-bold text-ink">{linhas[0].especie}</h2>
            <ul className="flex flex-col divide-y divide-line">
              {linhas.map((linha) => (
                <li key={linha.recipienteId} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="text-base text-ink">
                    {linha.recipiente}
                    <span className="text-sm text-muted">
                      {' '}
                      · {linha.lotes} {linha.lotes === 1 ? 'lote' : 'lotes'}
                    </span>
                  </span>
                  <span className="text-lg font-bold text-ink">{formatQuantidade(linha.quantidade)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
