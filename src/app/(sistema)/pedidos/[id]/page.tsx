import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { AcaoRecolhivel } from '@/components/ui/AcaoRecolhivel';
import { Notice } from '@/components/ui/Notice';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { formatData } from '@/lib/datas';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { saldoEmProducao, saldoPronto } from '@/lib/estoque';
import { formatDateTime } from '@/lib/format';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { CANAIS_VENDA, SITUACOES_PEDIDO, type SituacaoPedido, findPedido, formatMoeda, totalItem, totalPedido } from '@/lib/pedidos';
import { chaveSaldo } from '@/lib/pedidos-rotulos';
import { can } from '@/lib/permissions';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { AdicionarItemForm } from './AdicionarItemForm';
import { ItemDoPedido } from './ItemDoPedido';
import { SituacaoForms } from './SituacaoForms';

interface PedidoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
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
 * T8.1 a T8.3, UC-31 e UC-32: a ficha do pedido, com o saldo de muda pronta ao
 * lado de cada item. **O saldo é lido a cada abertura desta página** (RF-56): é
 * a perda registrada no lote aparecendo no item do pedido, que é a interligação
 * que o trabalho existe para demonstrar.
 */
export default async function PedidoPage({ params, searchParams }: PedidoPageProps) {
  const user = await requirePageAccess('pedidos');
  const [{ id }, { feito }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const pedido = await findPedido(pool, id);
  if (!pedido) notFound();

  const emCadastro = pedido.situacao === 'cadastrado';
  const podeEditarItem = emCadastro && can(user.perfil, 'pedidos', 'A');
  const podeSituacao = can(user.perfil, 'confirmacao_pedido', 'A') && pedido.situacao !== 'cancelado';

  const [prontos, producao, especies, recipientes] = await Promise.all([
    saldoPronto(pool),
    saldoEmProducao(pool),
    podeEditarItem ? searchEspecies(pool) : [],
    podeEditarItem ? listRecipientes(pool) : [],
  ]);
  const porChave = new Map(prontos.map((linha) => [chaveSaldo(linha.especieId, linha.recipienteId), linha.quantidade]));
  const emProducao = new Map(producao.map((linha) => [chaveSaldo(linha.especieId, linha.recipienteId), linha.quantidade]));

  return (
    <main>
      <PageHeader area="3 · Comercial" title={`Pedido ${pedido.numero}`} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8">
        <Link href="/pedidos" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {feito === 'criado' && <Notice tone="success">Pedido {pedido.numero} registrado.</Notice>}

        <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-ink">{pedido.cliente}</h2>
              {pedido.clienteTelefone && <p className="text-sm text-muted">{pedido.clienteTelefone}</p>}
            </div>
            <Pill tone={TOM[pedido.situacao]}>{SITUACOES_PEDIDO[pedido.situacao]}</Pill>
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

        {!emCadastro && (
          <Notice tone={pedido.situacao === 'cancelado' ? 'warning' : 'info'}>
            {pedido.situacao === 'cancelado'
              ? 'Pedido cancelado. Os itens ficam como estavam, para consulta.'
              : `Pedido em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}: o item não muda por aqui.`}
          </Notice>
        )}

        <h2 className="mt-2 text-sm font-bold tracking-widest text-muted uppercase">Itens</h2>
        {pedido.itens.length === 0 && <p className="text-base text-muted">Nenhum item neste pedido.</p>}
        <ul className="flex flex-col gap-3">
          {pedido.itens.map((item) => {
            const pronto = porChave.get(chaveSaldo(item.especieId, item.recipienteId)) ?? 0;
            const produzindo = emProducao.get(chaveSaldo(item.especieId, item.recipienteId)) ?? 0;
            const falta = item.quantidade > pronto;
            return (
              <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-semibold text-ink">{item.especie}</span>
                  <span className="text-base font-bold text-ink">{formatMoeda(totalItem(item))}</span>
                </div>
                <span className="text-sm text-muted">
                  {item.recipiente} · {formatQuantidade(item.quantidade)} × {formatMoeda(item.precoCentavos)}
                </span>
                {/* RF-56: somado dos lotes prontos agora, e não gravado no item */}
                <p className={`text-sm ${falta ? 'text-amber-800' : 'text-muted'}`}>
                  Pronto para venda: <strong>{formatQuantidade(pronto)}</strong>
                  {produzindo > 0 && ` · ${formatQuantidade(produzindo)} em produção, ainda não pronta`}
                  {falta && ` · faltam ${formatQuantidade(item.quantidade - pronto)}`}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-white p-4">
          <span className="text-base text-muted">Total do pedido</span>
          <span className="text-2xl font-bold text-ink">{formatMoeda(totalPedido(pedido.itens))}</span>
        </div>

        {/* O andamento vem antes da edição: quem abre a ficha quer o próximo passo, não o formulário */}
        {podeSituacao && <SituacaoForms pedidoId={pedido.id} situacao={pedido.situacao} perfil={user.perfil} />}

        {podeEditarItem && (
          <AcaoRecolhivel titulo="Alterar itens do pedido">
            <div className="flex flex-col gap-4">
              <ul className="flex flex-col gap-4">
                {pedido.itens.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1">
                    <span className="text-base font-semibold text-ink">{item.especie}</span>
                    <span className="text-sm text-muted">{item.recipiente}</span>
                    <ItemDoPedido
                      pedidoId={pedido.id}
                      itemId={item.id}
                      quantidade={item.quantidade}
                      precoCentavos={item.precoCentavos}
                    />
                  </li>
                ))}
              </ul>
              <AdicionarItemForm
                pedidoId={pedido.id}
                especies={especies.filter((e) => e.ativa).map((e) => ({ value: e.id, label: nomeExibido(e) }))}
                recipientes={recipientes
                  .filter((r) => r.ativo)
                  .map((r) => ({
                    value: r.id,
                    label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}`,
                  }))}
              />
            </div>
          </AcaoRecolhivel>
        )}
      </div>
    </main>
  );
}
