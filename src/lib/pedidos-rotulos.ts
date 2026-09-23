/**
 * Rótulos e contas do pedido que o navegador pode receber: sem SQL e sem `pg`
 * (RNF-11, TA-60). O servidor usa os mesmos, pelas reexportações de `pedidos.ts`.
 */
import { somaDias } from './datas';
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
 * cadastra e decide; a conferência no viveiro e a separação são da gerência, e a
 * chefia também as executa. Saber de quem o pedido está esperando é o que a
 * lista usa para pôr a etiqueta de providência.
 *
 * Substitui as três situações da RN-48 (`rascunho`, `confirmado`, `cancelado`),
 * que descreviam um comercial sem conferência nem separação.
 */
export const SITUACOES_PEDIDO = {
  cadastrado: 'Orçamento',
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
  por: readonly Exclude<Perfil, 'admin'>[];
  rotulo: string;
}

/**
 * **A chefia executa todas as fases, e a gerência só duas**: conferir no viveiro
 * e separar a carga. A gerência não fica de fora das outras por proteção, e sim
 * porque são decisão comercial (D4 §3.2); a chefia entra nas duas da gerência
 * porque é ela quem faz o trabalho quando a gerência não está.
 */
const CHEFIA_E_GERENCIA = ['chefia', 'gerencia'] as const;
const SO_CHEFIA = ['chefia'] as const;

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
  { de: 'cadastrado', para: 'verificando', por: CHEFIA_E_GERENCIA, rotulo: 'Iniciar verificação' },
  { de: 'verificando', para: 'verificado', por: CHEFIA_E_GERENCIA, rotulo: 'Enviar para a chefia' },
  { de: 'verificado', para: 'aprovado', por: SO_CHEFIA, rotulo: 'Aprovar pedido' },
  { de: 'verificado', para: 'pendente_alteracao', por: SO_CHEFIA, rotulo: 'Solicitar alteração' },
  { de: 'aprovado', para: 'separando', por: CHEFIA_E_GERENCIA, rotulo: 'Organizar cargas' },
  { de: 'separando', para: 'pronto_envio', por: CHEFIA_E_GERENCIA, rotulo: 'Concluir separação' },
  ...EDITAVEIS_PELA_CHEFIA.map((de) => ({
    de,
    para: 'cadastrado' as const,
    por: SO_CHEFIA,
    rotulo: 'Salvar e reenviar para verificação',
  })),
  ...CANCELAVEIS.map((de) => ({ de, para: 'cancelado' as const, por: SO_CHEFIA, rotulo: 'Cancelar pedido' })),
];

/** O admin passa por cima, como em `can`; o resto precisa estar na lista da transição. */
function executa(transicao: Transicao, perfil: Perfil): boolean {
  return perfil === 'admin' || (transicao.por as readonly Perfil[]).includes(perfil);
}

/**
 * A trava de verdade é do servidor (RF-57), e esta função é o contrato que ela
 * consulta. Esconder o botão na tela não impede o formulário reenviado.
 */
export function podeTransicionar(de: SituacaoPedido, para: SituacaoPedido, perfil: Perfil): boolean {
  return TRANSICOES.some((t) => t.de === de && t.para === para && executa(t, perfil));
}

/** O que este perfil pode fazer com o pedido agora, para a tela montar os botões. */
export function transicoesDe(de: SituacaoPedido, perfil: Perfil): readonly Transicao[] {
  return TRANSICOES.filter((t) => t.de === de && executa(t, perfil));
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

/** Altura maior que isto no campo do pedido é dedo escorregando, e não muda. */
const ALTURA_MAXIMA_M = 20;
/** Abaixo disto seria semente, e não muda pronta para venda. */
const ALTURA_MINIMA_M = 0.05;

/**
 * A altura da muda pedida, em metros, como o viveiro fala: 0,80 · 1,20.
 *
 * **Vazio é nulo, e não erro** (RF-54): a altura é opcional, porque o
 * recipiente já determina o porte na maior parte das vendas. Quem digita
 * ponto no lugar da vírgula é entendido do mesmo jeito.
 *
 * **Centímetro também é entendido**, porque é como a muda se mede na trena:
 * "80 cm" é 0,80 m, e o número inteiro sem unidade a partir de 10 é lido em
 * centímetros ("120" é 1,20 m). Abaixo de 10 o inteiro é metro ("2" é 2,00 m):
 * muda de menos de 10 cm não se vende, e árvore de mais de 10 m não cabe no
 * caminhão.
 */
export function parseAltura(text: string): { error: string } | { value: number | null } {
  const texto = text.trim();
  const emCentimetros = /cm$/i.test(texto);
  const limpo = texto.replace(/\s*c?m$/i, '').replace(/\s/g, '');
  if (limpo === '') return { value: null };
  const normalizado = limpo.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) {
    return {
      error: 'A altura precisa ser um valor em metros, como 1,20, ou em centímetros, como 120.',
    };
  }
  const semUnidade = !/m$/i.test(texto);
  const inteiroEmCentimetros = semUnidade && /^\d+$/.test(normalizado) && Number(normalizado) >= 10;
  const valor = Number(normalizado);
  const metros = Math.round((emCentimetros || inteiroEmCentimetros ? valor / 100 : valor) * 100) / 100;
  if (metros < ALTURA_MINIMA_M) return { error: 'A altura precisa ser de ao menos 0,05 m.' };
  if (metros > ALTURA_MAXIMA_M) return { error: 'A altura precisa ser de até 20 m.' };
  return { value: metros };
}

/** A altura na tela, com a unidade junto. Nula não escreve nada. */
export function formatAltura(metros: number | null | undefined): string {
  if (metros === null || metros === undefined) return '';
  return `${metros.toFixed(2).replace('.', ',')} m`;
}

/** A altura de volta no campo, sem a unidade, para ser editada. */
export function alturaParaCampo(metros: number | null | undefined): string {
  if (metros === null || metros === undefined) return '';
  return metros.toFixed(2).replace('.', ',');
}

/**
 * O campo de altura ao perder o foco: "120" vira "1,20 m", para a pessoa ver
 * na hora como o sistema entendeu. O que não dá para entender fica como veio,
 * e o erro aparece no envio.
 */
export function normalizaCampoAltura(texto: string): string {
  const lida = parseAltura(texto);
  return 'error' in lida ? texto : formatAltura(lida.value);
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
  /** Só é preciso para achar o pai do filho de um item genérico. */
  id?: string;
  /** Nula até o cliente dizer quantas; a aprovação a exige no item vendável. */
  quantidade: number | null;
  /** Nulo até alguém precificar, o que só acontece depois da conferência. */
  precoCentavos: number | null;
  /** Preenchido só no filho de um item genérico. */
  itemPaiId?: string | null;
  generico?: boolean;
  disponivel?: boolean | null;
  quantidadeDisponivel?: number | null;
}

/**
 * **O item que é vendido**, e que por isso tem preço, entra no total e é
 * cobrado na aprovação. É a mesma condição de `ITEM_VENDAVEL`, no SQL.
 *
 * - o item de topo com espécie;
 * - o genérico **com** quantidade ("500 mudas nativas"): os filhos dizem quais
 *   espécies o compõem, e herdam o preço dele;
 * - o filho do genérico **sem** quantidade ("manda o que tiver"): o genérico é
 *   uma lista montada pela gerência, e cada espécie dela é uma venda.
 *
 * O que a gerência disse que não tem nenhuma não é vendido: a aprovação o tira.
 */
export function itemVendavel(item: ItemCalculavel, itens: readonly ItemCalculavel[]): boolean {
  if (item.disponivel === false && item.quantidadeDisponivel === 0) return false;
  if (!item.itemPaiId) return !item.generico || item.quantidade !== null;
  const pai = itens.find((outro) => outro.id === item.itemPaiId);
  return pai !== undefined && pai.quantidade === null;
}

/** RF-55: o total do item é quantidade por preço, em centavos. Sem preço, nulo. */
export function totalItem(item: ItemCalculavel): number | null {
  return item.precoCentavos === null || item.quantidade === null ? null : item.quantidade * item.precoCentavos;
}

/**
 * RF-55: o total do pedido é a soma dos itens vendáveis (`itemVendavel`), e
 * nada mais entra nele. O filho do genérico com quantidade herda o preço do pai,
 * e contar os dois dobraria a venda.
 *
 * **Falta um preço ou uma quantidade, falta o total**: devolver a soma parcial
 * anunciaria um valor de venda menor que o verdadeiro, e é justamente o número
 * que a chefia olha para aprovar. O genérico sem quantidade e ainda sem
 * composição também deixa o total "a definir": a venda dele ainda não existe.
 */
export function totalPedido(itens: readonly ItemCalculavel[]): number | null {
  const listaVazia = itens.some(
    (item) => item.generico && !item.itemPaiId && item.quantidade === null && !itens.some((f) => f.itemPaiId === item.id),
  );
  if (listaVazia) return null;
  const vendaveis = itens.filter((item) => itemVendavel(item, itens));
  if (vendaveis.some((item) => item.precoCentavos === null || item.quantidade === null)) return null;
  return vendaveis.reduce((soma, item) => soma + item.quantidade! * item.precoCentavos!, 0);
}

/**
 * Quantas mudas a conferência confirmou: o que a gerência contou, ou a
 * quantidade pedida quando ela respondeu "tem tudo". É o teto da negociação,
 * e pedir mais do que isso é voltar à conferência.
 */
export function quantidadeConfirmada(item: {
  quantidade: number | null;
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
}): number {
  if (item.disponivel === null) return item.quantidade ?? 0;
  return item.quantidadeDisponivel ?? item.quantidade ?? 0;
}

/** O total que a tela imprime: "R$ 1.250,00" ou "a definir" enquanto faltar preço. */
export function formatTotal(centavos: number | null): string {
  return centavos === null ? 'a definir' : formatMoeda(centavos);
}

// ------------------------------------------------------------
// Verificação de disponibilidade (T8.9)
// ------------------------------------------------------------

/** O que a gerência responde sobre um item, andando no pátio. */
export type EstadoDisponibilidade = 'disponivel' | 'parcial' | 'indisponivel';

/** As três colunas de `pedidos_itens` que o estado resolve. */
export interface Disponibilidade {
  disponivel: boolean;
  quantidadeDisponivel: number | null;
  recipienteDisponivelId: string | null;
}

/** O que a conferência precisa saber do item para interpretar a resposta. */
export interface ItemParaResponder {
  /** Nula quando o cliente não disse quantas: a resposta é "quantas tem". */
  quantidade: number | null;
  /** Nulo quando o cliente não disse o tamanho: a resposta diz em qual está. */
  recipienteId: string | null;
}

/**
 * Três botões viram três colunas. **Parcial e indisponível compartilham
 * `disponivel = false`**, e quem os distingue é a quantidade: zero é "não tem
 * nenhuma", maior que zero é "tem só isto". É a mesma forma do CHECK
 * `pedidos_itens_disponibilidade_coerente`, e esta função existe para a tela e
 * o servidor chegarem nela pelo mesmo caminho.
 *
 * **O item que chegou incompleto muda a pergunta.** Sem quantidade, não há
 * "tem tudo" nem "tem parte": a gerência diz quantas tem ("tenho 350"), e
 * `disponivel` é só "tem alguma". Sem recipiente, toda resposta com muda diz em
 * qual recipiente ela está, porque é a única informação de tamanho que o pedido
 * vai ter. No item completo o recipiente conferido é opcional no "tem tudo":
 * "tem, mas em 17x22".
 */
export function resolveDisponibilidade(
  estado: EstadoDisponibilidade,
  item: ItemParaResponder,
  extras: { quantidade?: number | null; recipienteId?: string | null } = {},
): { error: string } | { value: Disponibilidade } {
  if (estado === 'indisponivel') {
    return { value: { disponivel: false, quantidadeDisponivel: 0, recipienteDisponivelId: null } };
  }

  // Conferido igual ao pedido não é informação: grava nulo, como "tem tudo" sempre gravou
  const conferido = extras.recipienteId && extras.recipienteId !== item.recipienteId ? extras.recipienteId : null;
  if (!item.recipienteId && !conferido) {
    return { error: 'Escolha o recipiente em que a muda está.' };
  }

  if (item.quantidade === null || estado === 'parcial') {
    const quantidade = extras.quantidade ?? null;
    if (quantidade === null || !Number.isInteger(quantidade) || quantidade < 1) {
      return { error: 'Informe quantas mudas existem, um número inteiro maior que zero.' };
    }
    if (item.quantidade === null) {
      return { value: { disponivel: true, quantidadeDisponivel: quantidade, recipienteDisponivelId: conferido } };
    }
    if (quantidade >= item.quantidade) {
      return { error: 'Na parcial a quantidade precisa ser menor que a pedida. Se tem tudo, use "Tem tudo".' };
    }
    return { value: { disponivel: false, quantidadeDisponivel: quantidade, recipienteDisponivelId: conferido } };
  }

  return { value: { disponivel: true, quantidadeDisponivel: null, recipienteDisponivelId: conferido } };
}

/** Uma espécie escolhida para compor um item genérico. */
export interface LinhaComposicao {
  especieId: string;
  recipienteId: string;
  quantidade: number;
}

/**
 * A composição do item genérico: quais espécies atendem "500 mudas nativas".
 *
 * **Com quantidade no pai, a soma tem de fechar exatamente.** Menos que o pedido entregaria menos do
 * que foi vendido; mais entregaria muda que ninguém comprou. E o escopo, quando
 * o cliente deu um, é **bloqueio rígido**: a compensação ambiental que exige
 * cinco espécies do bioma não aceita a sexta, por mais que o viveiro a tenha.
 *
 * **Sem quantidade no pai não há soma a fechar**: "manda o que tiver" é a
 * gerência montando a lista, e cada linha é uma venda própria.
 */
export function validarComposicaoGenerico(
  quantidadePai: number | null,
  linhas: readonly LinhaComposicao[],
  permitidas: readonly string[] = [],
): { error: string } | { value: readonly LinhaComposicao[] } {
  if (linhas.length === 0) return { error: 'Escolha ao menos uma espécie para compor o item.' };

  for (const [indice, linha] of linhas.entries()) {
    const posicao = `linha ${indice + 1}`;
    if (!linha.especieId) return { error: `Escolha a espécie da ${posicao}.` };
    if (!linha.recipienteId) return { error: `Escolha o recipiente da ${posicao}.` };
    if (!Number.isInteger(linha.quantidade) || linha.quantidade < 1) {
      return { error: `Informe a quantidade da ${posicao}, um número inteiro maior que zero.` };
    }
    if (permitidas.length > 0 && !permitidas.includes(linha.especieId)) {
      return { error: `A espécie da ${posicao} não está entre as que o cliente aceita.` };
    }
  }

  if (quantidadePai === null) return { value: linhas };
  const soma = linhas.reduce((total, linha) => total + linha.quantidade, 0);
  if (soma < quantidadePai) return { error: `Faltam ${quantidadePai - soma} mudas para fechar o item.` };
  if (soma > quantidadePai) return { error: `Passou ${soma - quantidadePai} mudas do que o item pede.` };

  return { value: linhas };
}

// ------------------------------------------------------------
// Cargas (T8.9)
// ------------------------------------------------------------

/**
 * RN-53 para a carga: **dois valores, e não três**. Um estado intermediário de
 * "separando" seria gravado no primeiro item marcado e não diria nada que o
 * progresso de itens separados já não diga. O CHECK do banco tem a mesma lista,
 * e um teste compara as duas.
 */
export const SITUACOES_CARGA = {
  pendente: 'Pendente',
  pronto: 'Pronto',
} as const;

export type SituacaoCarga = keyof typeof SITUACOES_CARGA;

export interface ItemParaCarga {
  id: string;
  quantidade: number;
  nome?: string;
}

export interface LinhaCarga {
  itemId: string;
  quantidade: number;
}

/**
 * A divisão do pedido em viagens. **Cada item tem de fechar exatamente**: uma
 * muda que não entrou em carga nenhuma é uma muda que ninguém vai separar, e o
 * caminhão sai sem ela sem que nada no sistema avise.
 *
 * Carga sem item nenhum não é erro aqui: ela é descartada e as demais são
 * renumeradas na gravação, porque abrir uma carga a mais e não usá-la é o
 * caminho normal de quem está decidindo quantas viagens serão.
 */
export function validarDivisaoCargas(
  itens: readonly ItemParaCarga[],
  cargas: readonly (readonly LinhaCarga[])[],
): { error: string } | { value: readonly (readonly LinhaCarga[])[] } {
  if (cargas.length === 0) return { error: 'Divida o pedido em ao menos uma carga.' };

  const porItem = new Map(itens.map((item) => [item.id, 0]));
  for (const carga of cargas) {
    for (const linha of carga) {
      const acumulado = porItem.get(linha.itemId);
      if (acumulado === undefined) return { error: 'Há item na carga que não é deste pedido.' };
      if (!Number.isInteger(linha.quantidade) || linha.quantidade < 0) {
        return { error: 'A quantidade da carga precisa ser um número inteiro, zero ou mais.' };
      }
      porItem.set(linha.itemId, acumulado + linha.quantidade);
    }
  }

  for (const item of itens) {
    const soma = porItem.get(item.id)!;
    if (soma !== item.quantidade) {
      const qual = item.nome ? `${item.nome}: a` : 'A';
      return { error: `${qual} soma das cargas (${soma}) não bate com o total do item (${item.quantidade}).` };
    }
  }

  return { value: cargas };
}

// ------------------------------------------------------------
// Urgência (T8.9)
// ------------------------------------------------------------

/** Primeira regra que casar, da mais urgente para a menos. */
export type Urgencia = 'atrasada' | 'entrega_hoje' | 'entrega_amanha' | 'carregar_hoje' | 'em_breve' | null;

export const ROTULO_URGENCIA: Record<Exclude<Urgencia, null>, string> = {
  atrasada: 'ATRASADO',
  entrega_hoje: 'ENTREGA HOJE',
  entrega_amanha: 'ENTREGA AMANHÃ',
  carregar_hoje: 'CARREGAR HOJE',
  em_breve: 'EM BREVE',
};

/** Até aqui o pedido ainda é "em breve"; depois disso, nem etiqueta ganha. */
const DIAS_EM_BREVE = 3;

/**
 * Quanto o pedido corre, lido das datas e de nada mais. Quem decide se a
 * etiqueta aparece é a tela, que sabe se o pedido já está pronto para envio.
 *
 * As datas chegam como `AAAA-MM-DD` e são comparadas como texto, que para este
 * formato dá a mesma ordem que a cronológica, e não passa por `Date` nenhum:
 * `new Date('2026-09-21')` seria meia-noite em UTC, e no fuso do viveiro isso é
 * o dia 20.
 */
export function urgenciaPedido(hoje: string, dataEntrega: string | null, diaDeCarregar: string | null): Urgencia {
  if (!dataEntrega) return null;
  if (dataEntrega < hoje) return 'atrasada';
  if (dataEntrega === hoje) return 'entrega_hoje';
  if (diaDeCarregar && diaDeCarregar <= hoje) return 'carregar_hoje';
  if (dataEntrega <= somaDias(hoje, 1)) return 'entrega_amanha';
  if (dataEntrega <= somaDias(hoje, DIAS_EM_BREVE)) return 'em_breve';
  return null;
}
