import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { montarSaldos } from '@/components/pedidos/linhas-pedido';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { formatData } from '@/lib/datas';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { saldoDisponivel } from '@/lib/estoque';
import { formatDateTime } from '@/lib/format';
import { CANAIS_VENDA, SITUACOES_PEDIDO, type SituacaoPedido, findPedido, listHistorico } from '@/lib/pedidos';
import { podeTransicionar } from '@/lib/pedidos-rotulos';
import { can } from '@/lib/permissions';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { CancelarPedido } from './CancelarPedido';
import { ItensDaFicha } from './ItensDaFicha';
import { LinhaDoTempo } from './LinhaDoTempo';

interface PedidoPageProps {
  params: Promise<{ id: string }>;
}

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

/**
 * T8.1 a T8.3, UC-31 e UC-32: a ficha do pedido. De cima para baixo: o cliente,
 * o andamento, o próximo passo, os itens e, no fim, o cancelamento.
 *
 * **O saldo é lido a cada abertura desta página** (RF-56): é a perda registrada
 * no lote aparecendo no item do pedido, que é a interligação que o trabalho
 * existe para demonstrar.
 */
export default async function PedidoPage({ params }: PedidoPageProps) {
  const user = await requirePageAccess('pedidos');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const pedido = await findPedido(pool, id);
  if (!pedido) notFound();

  const { situacao } = pedido;
  const editaItens = situacao === 'cadastrado' && can(user.perfil, 'pedidos', 'A');
  // RF-55: o preço se digita depois da conferência, e é da chefia (D4 §3.2)
  const negocia =
    (situacao === 'verificado' || situacao === 'pendente_alteracao') &&
    can(user.perfil, 'pedidos', 'A') &&
    user.perfil !== 'gerencia';
  const modo = editaItens ? 'cadastro' : negocia ? 'negociacao' : 'leitura';

  const [historico, disponiveis, especies, recipientes] = await Promise.all([
    listHistorico(pool, pedido.id),
    saldoDisponivel(pool),
    editaItens ? searchEspecies(pool) : [],
    editaItens ? listRecipientes(pool) : [],
  ]);

  return (
    <main>
      <PageHeader area="3 · Comercial" title={`Pedido ${pedido.numero}`} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8 lg:max-w-4xl">
        <Link href="/pedidos" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>

        <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">{pedido.cliente}</h2>
              {pedido.clienteTelefone && <p className="text-sm text-muted">{pedido.clienteTelefone}</p>}
            </div>
            <Pill tone={TOM[situacao]}>{SITUACOES_PEDIDO[situacao]}</Pill>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-base">
            <div>
              <dt className="text-sm text-muted">Canal</dt>
              <dd className="font-semibold text-ink">{CANAIS_VENDA[pedido.canal]}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Entrega prevista</dt>
              <dd className="font-semibold text-ink">{pedido.dataEntrega ? formatData(pedido.dataEntrega) : 'não informada'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-sm text-muted">Registro</dt>
              <dd className="font-semibold text-ink">
                {formatDateTime(pedido.criadoEm)} · {pedido.criadoPor}
              </dd>
            </div>
          </dl>
          {pedido.observacoes && <p className="text-base text-muted">{pedido.observacoes}</p>}
        </section>

        <LinhaDoTempo fases={historico} />

        <ItensDaFicha
          // Item tirado na negociação some da lista: a negociação recomeça do banco
          key={modo === 'negociacao' ? pedido.itens.map((item) => item.id).join() : modo}
          pedidoId={pedido.id}
          modo={modo}
          itens={pedido.itens}
          saldos={montarSaldos(disponiveis)}
          opcoesEspecie={especies
            .filter((e) => e.ativa)
            .map((e) => ({
              value: e.id,
              label: nomeExibido(e),
              detalhe: e.nomeCientifico && e.nomeCientifico !== nomeExibido(e) ? e.nomeCientifico : undefined,
            }))}
          recipientes={recipientes
            .filter((r) => r.ativo)
            .map((r) => ({
              value: r.id,
              label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}`,
            }))}
          faltaBloqueia={situacao === 'verificado'}
          frete={{ centavos: pedido.freteCentavos, origem: pedido.freteOrigem, distanciaKm: pedido.freteDistanciaKm }}
          proximoPasso={{
            pedidoId: pedido.id,
            situacao,
            podeConferir: can(user.perfil, 'verificacao_pedido', 'A'),
            podeDecidir: podeTransicionar(situacao, 'cadastrado', user.perfil),
            podeSeparar: can(user.perfil, 'cargas_pedido', 'A'),
          }}
        />

        {podeTransicionar(situacao, 'cancelado', user.perfil) && (
          <div className="mt-4">
            <CancelarPedido pedidoId={pedido.id} />
          </div>
        )}
      </div>
    </main>
  );
}
