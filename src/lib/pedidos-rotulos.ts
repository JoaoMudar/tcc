/**
 * Rótulos e contas do pedido que o navegador pode receber: sem SQL e sem `pg`
 * (RNF-11, TA-60). O servidor usa os mesmos, pelas reexportações de `pedidos.ts`.
 */

/** RN-42: lista fechada de cinco valores, e não entidade própria. `atacado` é o padrão. */
export const CANAIS_VENDA = {
  atacado: 'Atacado',
  compensacao: 'Compensação ambiental',
  paisagismo: 'Paisagismo',
  prefeitura: 'Prefeitura',
  varejo: 'Varejo',
} as const;

export type CanalVenda = keyof typeof CANAIS_VENDA;

export const CANAL_PADRAO: CanalVenda = 'atacado';

export function isCanalVenda(value: string): value is CanalVenda {
  return Object.hasOwn(CANAIS_VENDA, value);
}

/** RN-48: três situações, e confirmar é o ato que trava os itens (RF-57). */
export const SITUACOES_PEDIDO = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
} as const;

export type SituacaoPedido = keyof typeof SITUACOES_PEDIDO;

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * O preço trafega em centavos, inteiro, do formulário ao banco. Guardá-lo como
 * número quebrado faria 0,1 + 0,2 aparecer no total do pedido, e total de venda
 * que não fecha na conferência é o defeito que este sistema não pode ter.
 */
export function formatMoeda(centavos: number): string {
  return MOEDA.format(centavos / 100);
}

/** Centavos no formato que o `NUMERIC(10,2)` recebe: "1250" vira "12.50". */
export function centavosParaSql(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/** NUMERIC(10,2): oito dígitos antes da vírgula. */
const MAX_CENTAVOS = 99_999_999_99;

/**
 * "12,50", "12.50", "R$ 1.234,56" e "12" viram centavos; o resto é `null`. A
 * vírgula é o separador decimal de quem digita, e o ponto antes dela é milhar.
 */
export function parsePreco(text: string): { error: string } | { value: number } {
  const limpo = text.trim().replace(/^R\$/, '').replace(/\s/g, '');
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) {
    return { error: 'O preço precisa ser um valor como 12,50.' };
  }
  const centavos = Math.round(Number(normalizado) * 100);
  if (centavos <= 0) return { error: 'O preço precisa ser maior que zero.' };
  if (centavos > MAX_CENTAVOS) return { error: 'O preço é grande demais.' };
  return { value: centavos };
}

/** O campo volta para a tela como a pessoa espera lê-lo, e não como "1250". */
export function precoParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

/**
 * RF-56: a chave do saldo é o par espécie e recipiente, e é ela que liga o item
 * do pedido à leitura da Produção. Fica aqui, e não no SQL, porque a tela de
 * pedido novo faz a mesma busca no navegador enquanto a pessoa digita.
 */
export function chaveSaldo(especieId: string, recipienteId: string): string {
  return `${especieId}:${recipienteId}`;
}

export interface ItemCalculavel {
  quantidade: number;
  precoCentavos: number;
}

/** RF-55: o total do item é quantidade por preço, em centavos. */
export function totalItem(item: ItemCalculavel): number {
  return item.quantidade * item.precoCentavos;
}

/** RF-55: o total do pedido é a soma dos itens, e nada mais entra nele. */
export function totalPedido(itens: readonly ItemCalculavel[]): number {
  return itens.reduce((soma, item) => soma + totalItem(item), 0);
}
