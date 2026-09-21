import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { formatData, hojeNoViveiro } from '@/lib/datas';
import pool from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import {
  CANAIS_VENDA,
  SITUACOES_PEDIDO,
  type SituacaoPedido,
  formatMoeda,
  listClientes,
  listPedidos,
  parseFiltroPedidos,
} from '@/lib/pedidos';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';

interface PedidosPageProps {
  searchParams: Promise<{ de?: string; ate?: string; cliente?: string; canal?: string }>;
}

const CANAL_OPCOES = Object.entries(CANAIS_VENDA).map(([value, label]) => ({ value, label }));

const TOM: Record<SituacaoPedido, PillTone> = { rascunho: 'neutral', confirmado: 'green', cancelado: 'red' };

/** T8.4, RF-58: a carteira de pedidos, com filtro por cliente, canal e período. */
export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  // TA-03: a gerência que digita este endereço cai em /sem-permissao
  const user = await requirePageAccess('pedidos');
  const filtro = parseFiltroPedidos(await searchParams, hojeNoViveiro());
  const [lista, clientes] = await Promise.all([listPedidos(pool, filtro), listClientes(pool)]);
  const total = lista.reduce((soma, pedido) => soma + (pedido.situacao === 'cancelado' ? 0 : pedido.totalCentavos), 0);

  return (
    <main>
      <PageHeader area="3 · Comercial" title="Pedidos" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        {can(user.perfil, 'pedidos', 'C') && (
          <Link
            href="/pedidos/novo"
            className="flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark"
          >
            Novo pedido
          </Link>
        )}

        <form method="get" className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="De" name="de" type="date" defaultValue={filtro.de} />
            <TextField label="Até" name="ate" type="date" defaultValue={filtro.ate} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Cliente"
              name="cliente"
              placeholder="Todos"
              options={[{ value: '', label: 'Todos' }, ...clientes.map((c) => ({ value: c.id, label: c.nome }))]}
              defaultValue={filtro.clienteId ?? ''}
            />
            <SelectField
              label="Canal"
              name="canal"
              placeholder="Todos"
              options={[{ value: '', label: 'Todos' }, ...CANAL_OPCOES]}
              defaultValue={filtro.canal ?? ''}
            />
          </div>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-sm text-muted">Pedidos</p>
            <p className="text-2xl font-bold text-ink">{lista.length}</p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-sm text-muted">Total, sem os cancelados</p>
            <p className="text-2xl font-bold text-ink">{formatMoeda(total)}</p>
          </div>
        </div>
        <p className="text-sm text-muted">
          Registrados de {formatData(filtro.de)} a {formatData(filtro.ate)}.
        </p>

        {lista.length === 0 ? (
          <p className="text-base text-muted">Nenhum pedido no filtro escolhido.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
            {lista.map((pedido) => (
              <li key={pedido.id}>
                <Link href={`/pedidos/${pedido.id}`} className="flex flex-col gap-1 px-4 py-3 active:bg-brand-light">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-semibold text-ink">
                      {pedido.numero} · {pedido.cliente}
                    </span>
                    <span className="text-base font-bold text-ink">{formatMoeda(pedido.totalCentavos)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted">
                      {CANAIS_VENDA[pedido.canal]} · {formatQuantidade(pedido.itens)}{' '}
                      {pedido.itens === 1 ? 'item' : 'itens'} · {formatDateTime(pedido.criadoEm)}
                      {pedido.dataEntrega && ` · entrega ${formatData(pedido.dataEntrega)}`}
                    </span>
                    <Pill tone={TOM[pedido.situacao]}>{SITUACOES_PEDIDO[pedido.situacao]}</Pill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
