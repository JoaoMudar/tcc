import { formatQuantidade } from '@/lib/lotes-rotulos';
import { formatAltura, formatMoeda, formatTotal, itemVendavel, totalItem, totalPedido } from '@/lib/pedidos-rotulos';

export interface ItemExibido {
  id: string;
  especie: string | null;
  /** Nulo quando o cliente não disse o tamanho: a conferência responde. */
  recipiente: string | null;
  /** Altura pedida, em metros. Nula é "o cliente não pediu altura". */
  alturaM?: number | null;
  /** Nula no orçamento: o cliente ainda não disse quantas. */
  quantidade: number | null;
  precoCentavos: number | null;
  itemPaiId: string | null;
  especificacao: string | null;
  generico?: boolean;
  disponivel?: boolean | null;
  quantidadeDisponivel?: number | null;
  /** RF-56: saldo lido dos lotes agora, quando a tela o carrega. */
  pronto?: number | null;
  emProducao?: number | null;
}

interface ItensDoPedidoProps {
  itens: readonly ItemExibido[];
}

/**
 * T8.1: os itens do pedido em grade, uma linha por item.
 *
 * **Espécie, recipiente e quantidade sempre; preço e total só quando existem.**
 * O preço é digitado depois da conferência, e uma coluna vazia esperando valor
 * seria uma pergunta sem resposta em todo pedido recém-cadastrado.
 *
 * Não é `<table>`: a grade de três colunas cabe num celular de 360px e deixa o
 * nome da espécie ocupar o que sobra, enquanto uma tabela mandaria rolar para o
 * lado justamente onde o sistema mais é usado.
 */
export function ItensDoPedido({ itens }: ItensDoPedidoProps) {
  if (itens.length === 0) return <p className="text-base text-muted">Nenhum item neste pedido.</p>;

  const comPreco = itens.some((item) => item.precoCentavos !== null);
  const colunas = comPreco ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto]';
  const total = totalPedido(itens);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div
        className={`grid ${colunas} gap-x-3 border-b border-line px-4 py-2 text-xs font-bold tracking-wide text-muted uppercase`}
      >
        <span>Espécie</span>
        <span>Recipiente</span>
        <span className="text-right">Qtd</span>
        {comPreco && <span className="text-right">Total</span>}
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {itens.map((item) => {
          const filho = item.itemPaiId !== null;
          // O filho do genérico com quantidade herda o preço do pai, e não é
          // cobrado de novo; o da lista montada é venda própria (itemVendavel)
          const cobrado = itemVendavel(item, itens);
          const falta =
            item.pronto !== null && item.pronto !== undefined && item.quantidade !== null && item.quantidade > item.pronto;
          return (
            <li key={item.id} className={`grid ${colunas} gap-x-3 px-4 py-3 ${filho ? 'bg-gray-50' : ''}`}>
              <span className={`flex min-w-0 flex-col gap-0.5 ${filho ? 'pl-4' : ''}`}>
                <span className="text-base font-semibold text-ink">
                  {filho && <span className="text-muted">↳ </span>}
                  {item.especie ?? 'a definir na conferência'}
                </span>
                {item.especificacao && (
                  <span className="text-sm text-muted">Pedido do cliente: {item.especificacao}</span>
                )}
                {/* RF-56: somado dos lotes prontos agora, e não gravado no item */}
                {item.pronto !== null && item.pronto !== undefined && (
                  <span className={`text-sm ${falta ? 'text-amber-800' : 'text-muted'}`}>
                    Pronto para venda: <strong>{formatQuantidade(item.pronto)}</strong>
                    {!!item.emProducao && ` · ${formatQuantidade(item.emProducao)} em produção`}
                    {falta && ` · faltam ${formatQuantidade(item.quantidade! - item.pronto)}`}
                  </span>
                )}
              </span>
              {/* A altura anda junto do recipiente, e não em coluna própria: as
                  duas dizem o tamanho da muda, e uma coluna a mais estouraria os
                  360px do celular */}
              <span className="text-base text-muted">
                {item.recipiente ?? 'a definir'}
                {item.alturaM ? <span className="block text-sm">{formatAltura(item.alturaM)}</span> : null}
              </span>
              <span className="text-right text-base font-semibold text-ink">{item.quantidade === null ? 'a definir' : formatQuantidade(item.quantidade)}</span>
              {comPreco && (
                <span className="text-right text-base font-bold text-ink">
                  {cobrado ? formatTotal(totalItem(item)) : '·'}
                  {cobrado && item.precoCentavos !== null && (
                    <span className="block text-sm font-normal text-muted">
                      {formatMoeda(item.precoCentavos)} cada
                    </span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between gap-3 border-t border-line px-4 py-3">
        <span className="text-base text-muted">Total do pedido</span>
        <span className="text-2xl font-bold text-ink">{formatTotal(total)}</span>
      </div>
    </div>
  );
}
