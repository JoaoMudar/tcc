/**
 * Rótulos e contas do pedido que o navegador pode receber: sem SQL e sem `pg`
 * (RNF-11, TA-60). O servidor usa os mesmos, pelas reexportações de `pedidos.ts`.
 */
import type { Perfil } from './perfis';

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

/**
 * RN-53: o pedido percorre oito situações, e **cada uma tem dono**. A chefia
 * cadastra e decide; a gerência confere no viveiro e separa. Saber de quem o
 * pedido está esperando é o que a lista usa para pôr a etiqueta de providência.
 *
 * Substitui as três situações da RN-48 (`rascunho`, `confirmado`, `cancelado`),
 * que descreviam um comercial sem conferência nem separação.
 */
export const SITUACOES_PEDIDO = {
  cadastrado: 'Cadastrado',
  verificando: 'Verificando',
  verificado: 'Verificado',
  pendente_alteracao: 'Pendente de alteração',
  aprovado: 'Aprovado',
  separando: 'Separando',
  pronto_envio: 'Pronto para envio',
  cancelado: 'Cancelado',
} as const;

export type SituacaoPedido = keyof typeof SITUACOES_PEDIDO;

export function isSituacaoPedido(value: string): value is SituacaoPedido {
  return Object.hasOwn(SITUACOES_PEDIDO, value);
}

/** De quem o pedido está esperando. `null` nas duas situações de fim de linha. */
export const DONO_SITUACAO: Record<SituacaoPedido, Perfil | null> = {
  cadastrado: 'gerencia',
  verificando: 'gerencia',
  verificado: 'chefia',
  pendente_alteracao: 'chefia',
  aprovado: 'gerencia',
  separando: 'gerencia',
  pronto_envio: null,
  cancelado: null,
};

export interface Transicao {
  de: SituacaoPedido;
  para: SituacaoPedido;
  /** Admin não entra aqui: ele passa por cima, como em `can`. */
  por: Exclude<Perfil, 'admin'>;
  rotulo: string;
}

/**
 * Editar item **volta o pedido para o começo da conferência**: o que a gerência
 * apurou vale para os itens de antes, e quem mudou o pedido precisa que ela
 * olhe de novo. É a chefia quem edita, inclusive em `pendente_alteracao`, que é
 * a situação em que ela mesma foi chamada a mexer.
 */
const EDITAVEIS_PELA_CHEFIA = ['verificado', 'pendente_alteracao', 'aprovado', 'separando'] as const;

/**
 * **`pronto_envio` também cancela, e é a mesma razão de 21/09/2026**: a venda que
 * cai depois de pronta precisa ficar registrada, senão o pedido afirma para
 * sempre uma entrega que não houve.
 */
const CANCELAVEIS = (Object.keys(SITUACOES_PEDIDO) as SituacaoPedido[]).filter((s) => s !== 'cancelado');

export const TRANSICOES: readonly Transicao[] = [
  { de: 'cadastrado', para: 'verificando', por: 'gerencia', rotulo: 'Iniciar verificação' },
  { de: 'verificando', para: 'verificado', por: 'gerencia', rotulo: 'Enviar para a chefia' },
  { de: 'verificado', para: 'aprovado', por: 'chefia', rotulo: 'Aprovar pedido' },
  { de: 'verificado', para: 'pendente_alteracao', por: 'chefia', rotulo: 'Solicitar alteração' },
  { de: 'aprovado', para: 'separando', por: 'gerencia', rotulo: 'Organizar cargas' },
  { de: 'separando', para: 'pronto_envio', por: 'gerencia', rotulo: 'Concluir separação' },
  ...EDITAVEIS_PELA_CHEFIA.map((de) => ({
    de,
    para: 'cadastrado' as const,
    por: 'chefia' as const,
    rotulo: 'Salvar e reenviar para verificação',
  })),
  ...CANCELAVEIS.map((de) => ({ de, para: 'cancelado' as const, por: 'chefia' as const, rotulo: 'Cancelar pedido' })),
];

/**
 * A trava de verdade é do servidor (RF-57), e esta função é o contrato que ela
 * consulta. Esconder o botão na tela não impede o formulário reenviado.
 */
export function podeTransicionar(de: SituacaoPedido, para: SituacaoPedido, perfil: Perfil): boolean {
  return TRANSICOES.some((t) => t.de === de && t.para === para && (perfil === 'admin' || t.por === perfil));
}

/** O que este perfil pode fazer com o pedido agora, para a tela montar os botões. */
export function transicoesDe(de: SituacaoPedido, perfil: Perfil): readonly Transicao[] {
  return TRANSICOES.filter((t) => t.de === de && (perfil === 'admin' || t.por === perfil));
}

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
