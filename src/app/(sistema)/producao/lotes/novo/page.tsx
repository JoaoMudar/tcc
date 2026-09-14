import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { hojeNoViveiro } from '@/lib/datas';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { listCanteirosParaLote } from '@/lib/lotes';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { requirePageAccess } from '@/lib/auth/guards';
import { NovoLoteForm } from './NovoLoteForm';

/** F1 UC-22 · Criar lote (RF-32). Só espécie e recipiente em uso aparecem. */
export default async function NovoLotePage() {
  await requirePageAccess('lotes', 'C');
  const [especies, recipientes, canteiros] = await Promise.all([
    searchEspecies(pool),
    listRecipientes(pool),
    listCanteirosParaLote(pool),
  ]);
  const especieOptions = especies.filter((e) => e.ativa).map((e) => ({ value: e.id, label: nomeExibido(e) }));
  const recipienteOptions = recipientes
    .filter((r) => r.ativo)
    .map((r) => ({ value: r.id, label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}` }));
  const falta = [
    especieOptions.length === 0 && 'espécie',
    recipienteOptions.length === 0 && 'recipiente',
    canteiros.length === 0 && 'área com canteiro',
  ].filter(Boolean);

  return (
    <main>
      <PageHeader area="2 · Produção" title="Novo lote" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/producao/lotes" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {falta.length > 0 ? (
          <Notice tone="info">
            Para criar lote, cadastre antes: {falta.join(', ')}.{' '}
            <Link href="/cadastros" className="font-semibold underline">
              Ir aos cadastros
            </Link>
          </Notice>
        ) : (
          <NovoLoteForm especies={especieOptions} recipientes={recipienteOptions} canteiros={canteiros} hoje={hojeNoViveiro()} />
        )}
      </div>
    </main>
  );
}
