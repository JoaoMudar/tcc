import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { pedidosDoPeriodo } from '@/lib/cargas';
import { diaUtilAnterior, formatData, hojeNoViveiro, somaDias } from '@/lib/datas';
import pool from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import {
  CANAIS_VENDA,
  DONO_SITUACAO,
  ROTULO_URGENCIA,
  SITUACOES_PEDIDO,
  type SituacaoPedido,
  formatMoeda,
  listClientes,
  listPedidos,
  parseFiltroPedidos,
  urgenciaPedido,
} from '@/lib/pedidos';
import { PERFIL_LABELS } from '@/lib/perfis';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';
import { CalendarioCargas } from './CalendarioCargas';

interface PedidosPageProps {
  searchParams: Promise<{ de?: string; ate?: string; cliente?: string; canal?: string }>;
}

const CANAL_OPCOES = Object.entries(CANAIS_VENDA).map(([value, label]) => ({ value, label }));

const TOM: Record<SituacaoPedido, PillTone> = {
  cadastrado: 'neutral',
  verificando: 'blue',
  verificado: 'blue',
  pendente_alteracao: 'amber',
  aprovado: 'green',
  separando: 'blue',
  pronto_envio: 'green',
  cancelado: 'red',
};

/** T8.15: o que o pedido está esperando de quem, para a lista dizer a providência. */
const PROVIDENCIA: Partial<Record<SituacaoPedido, string>> = {
  aprovado: 'ORGANIZAR CARGAS',
  separando: 'SEPARANDO',
};

/** T8.4, RF-58: a carteira de pedidos, com filtro por cliente, canal e período. */
export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  // TA-03: a gerência que digita este endereço cai em /sem-permissao
  const user = await requirePageAccess('pedidos');
  const hoje = hojeNoViveiro();
  const filtro = parseFiltroPedidos(await searchParams, hoje);

  // O calendário cobre o mês inteiro, e não o filtro: quem carrega caminhão
  // planeja o mês, e o filtro da carteira é por data de registro, não de entrega.
  const mes = `${hoje.slice(0, 7)}-01`;
  const fimDoMes = somaDias(`${somaDias(mes, 31).slice(0, 7)}-01`, -1);

  const [lista, clientes, doMes] = await Promise.all([
    listPedidos(pool, filtro),
    listClientes(pool),
    pedidosDoPeriodo(pool, somaDias(mes, -7), fimDoMes),
  ]);
  const total = lista.reduce((soma, pedido) => soma + (pedido.situacao === 'cancelado' ? 0 : pedido.totalCentavos), 0);

  // O calendário é ferramenta de quem separa, e a chefia também o usa para saber
  // o que está por sair. Quem não mexe em carga não o vê.
  const veCalendario = can(user.perfil, 'cargas_pedido', 'L');

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

        {veCalendario && (
          <CalendarioCargas
            mes={mes}
            hoje={hoje}
            pedidos={doMes.map((pedido) => ({
              ...pedido,
              diaDeCarregar: diaUtilAnterior(pedido.dataEntrega),
            }))}
          />
        )}

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

                  {/* T8.15: de quem o pedido está esperando, o que há a fazer e
                      quanto corre. `DONO_SITUACAO` existia desde a fase anterior
                      esperando exatamente por esta linha. */}
                  {pedido.situacao !== 'cancelado' && pedido.situacao !== 'pronto_envio' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {DONO_SITUACAO[pedido.situacao] && (
                        <span className="text-sm text-muted">
                          esperando {PERFIL_LABELS[DONO_SITUACAO[pedido.situacao]!].toLowerCase()}
                        </span>
                      )}
                      {PROVIDENCIA[pedido.situacao] && (
                        <Pill tone="blue">{PROVIDENCIA[pedido.situacao]}</Pill>
                      )}
                      {(() => {
                        const urgencia = urgenciaPedido(
                          hoje,
                          pedido.dataEntrega,
                          pedido.dataEntrega ? diaUtilAnterior(pedido.dataEntrega) : null,
                        );
                        return urgencia ? <Pill tone="amber">{ROTULO_URGENCIA[urgencia]}</Pill> : null;
                      })()}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
