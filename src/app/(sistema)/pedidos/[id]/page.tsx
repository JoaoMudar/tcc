import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { ItensDoPedido } from '@/components/pedidos/ItensDoPedido';
import { AcaoRecolhivel } from '@/components/ui/AcaoRecolhivel';
import { Notice } from '@/components/ui/Notice';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Toast } from '@/components/ui/Toast';
import { formatData } from '@/lib/datas';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { saldoEmProducao, saldoPronto } from '@/lib/estoque';
import { formatDateTime } from '@/lib/format';
import { CANAIS_VENDA, SITUACOES_PEDIDO, type SituacaoPedido, findPedido } from '@/lib/pedidos';
import { chaveSaldo } from '@/lib/pedidos-rotulos';
import { can } from '@/lib/permissions';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { AdicionarItemForm } from './AdicionarItemForm';
import { ItemDoPedido } from './ItemDoPedido';
import { PrecosForm } from './PrecosForm';
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
  const podeConferir =
    can(user.perfil, 'verificacao_pedido', 'A') && (emCadastro || pedido.situacao === 'verificando');
  const podeSeparar =
    can(user.perfil, 'cargas_pedido', 'A') &&
    (pedido.situacao === 'aprovado' || pedido.situacao === 'separando');
  // RF-55: o preço se digita depois da conferência, e é da chefia (D4 §3.2)
  const podePrecificar =
    can(user.perfil, 'pedidos', 'A') &&
    (pedido.situacao === 'verificado' || pedido.situacao === 'pendente_alteracao');

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
        {feito === 'verificado' && (
          <Toast tone="success">Conferência enviada para a chefia. O pedido está aguardando aprovação.</Toast>
        )}

        {/* T8.12: a porta da conferência. Só aparece enquanto ela cabe, e para
            quem a executa: depois de aprovado a apuração já foi consumida. */}
        {podeConferir && (
          <Link
            href={`/pedidos/${pedido.id}/verificar`}
            className="min-h-touch flex items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white"
          >
            {emCadastro ? 'Começar a conferência no viveiro' : 'Continuar a conferência'}
          </Link>
        )}

        {/* T8.14: a porta do galpão, aberta do aprovado até a última carga */}
        {podeSeparar && (
          <Link
            href={`/pedidos/${pedido.id}/separar`}
            className="min-h-touch flex items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white"
          >
            {pedido.situacao === 'aprovado' ? 'Organizar as cargas' : 'Continuar a separação'}
          </Link>
        )}

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

        {/* Só o cancelamento é avisado: ele diz algo que a tela não mostra, que os
            itens continuam ali para consulta. Que o item não muda fora de
            `cadastrado` já é dito pela ausência do formulário de edição, e a
            trava de verdade é do servidor (`exigirCadastrado`). */}
        {pedido.situacao === 'cancelado' && (
          <Notice tone="warning">Pedido cancelado. Os itens ficam como estavam, para consulta.</Notice>
        )}

        <h2 className="mt-2 text-sm font-bold tracking-widest text-muted uppercase">Itens</h2>
        <ItensDoPedido
          itens={pedido.itens.map((item) => {
            // O genérico ainda não tem espécie, e por isso não tem saldo para ler
            const chave = item.especieId ? chaveSaldo(item.especieId, item.recipienteId) : null;
            return {
              id: item.id,
              especie: item.especie,
              recipiente: item.recipiente,
              alturaM: item.alturaM,
              quantidade: item.quantidade,
              precoCentavos: item.precoCentavos,
              itemPaiId: item.itemPaiId,
              especificacao: item.especificacao,
              pronto: chave ? (porChave.get(chave) ?? 0) : null,
              emProducao: chave ? (emProducao.get(chave) ?? 0) : null,
            };
          })}
        />

        {podePrecificar && (
          <PrecosForm
            pedidoId={pedido.id}
            itens={pedido.itens
              .filter((item) => item.itemPaiId === null)
              .map((item) => ({
                id: item.id,
                especie: item.especie ?? 'Espécie a definir',
                recipiente: item.recipiente,
                quantidade: item.quantidade,
                precoCentavos: item.precoCentavos,
              }))}
          />
        )}

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
                      alturaM={item.alturaM}
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
