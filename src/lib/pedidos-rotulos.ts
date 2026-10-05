/**
 * Rótulos e contas do pedido que o navegador pode receber: sem SQL e sem `pg`
 * (RNF-11, TA-60). O servidor usa os mesmos, pelas reexportações de `pedidos.ts`.
 */
import { normalizeTexto } from './busca-opcoes';
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
/** Abaixo disto seria semente, e não muda para venda. */
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

/** Quatro dígitos bastam: 99,99 m. O teto de 20 m fica com o `parseAltura`. */
const ALTURA_MAX_DIGITOS = 4;

/**
 * A máscara da altura na grade de itens, aplicada a cada tecla: os dígitos
 * entram pela direita e as duas últimas casas são os centímetros, como na
 * máquina de somar ("1" é 0,01 m, "123" é 1,23 m).
 *
 * O apagar que só tira o " m" do fim não mudaria nada, porque a máscara
 * devolveria a unidade; por isso ele tira o último dígito.
 */
export function mascaraAltura(novo: string, anterior: string): string {
  const digitosDe = (texto: string) => texto.replace(/\D/g, '').replace(/^0+/, '');
  let digitos = digitosDe(novo);
  if (digitos === digitosDe(anterior) && novo.length < anterior.length) digitos = digitos.slice(0, -1);
  digitos = digitos.slice(0, ALTURA_MAX_DIGITOS);
  return digitos ? formatAltura(Number(digitos) / 100) : '';
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

/** Os lotes abertos de um par espécie e recipiente que têm a mesma altura medida. */
export interface FaixaDeAltura {
  /** Nula é "ainda não medida". */
  alturaM: number | null;
  quantidade: number;
}

/** RN-62: quanto abaixo da altura pedida a muda ainda é oferecida para completar o item. */
export const TOLERANCIA_ALTURA_M = 0.2;

export interface SaldoDoItem {
  /** O que atende o item: a mesma espécie e recipiente, com altura igual ou maior que a pedida. */
  disponivel: number;
  /** Até 20 cm abaixo da pedida: não atende, mas pode completar o que falta (RN-62). */
  abaixo: number;
  /** Lotes sem altura medida, quando o item pede altura: não se sabe se atendem. */
  semAltura: number;
}

/**
 * RN-06, RN-62: o saldo que atende o item. Toda muda de lote aberto está à
 * venda, em qualquer fase; o que decide é a espécie, o recipiente e a altura.
 * Item sem altura é atendido por todos os lotes do par. A comparação é em
 * centímetros inteiros, para 1,00 - 0,20 não virar 0,7999.
 */
export function saldoDoItem(faixas: readonly FaixaDeAltura[] | undefined, alturaPedidaM: number | null): SaldoDoItem {
  const saldo: SaldoDoItem = { disponivel: 0, abaixo: 0, semAltura: 0 };
  const pedida = alturaPedidaM === null ? null : Math.round(alturaPedidaM * 100);
  const piso = pedida === null ? null : pedida - Math.round(TOLERANCIA_ALTURA_M * 100);
  for (const faixa of faixas ?? []) {
    const altura = faixa.alturaM === null ? null : Math.round(faixa.alturaM * 100);
    if (pedida === null) saldo.disponivel += faixa.quantidade;
    else if (altura === null) saldo.semAltura += faixa.quantidade;
    else if (altura >= pedida) saldo.disponivel += faixa.quantidade;
    else if (altura >= piso!) saldo.abaixo += faixa.quantidade;
  }
  return saldo;
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
 *
 * **Nulo é "sem teto"**: o item sem quantidade respondido com "Tem" e sem
 * número (P12). A gerência disse que existe, não quantas, e a chefia acerta o
 * número com o cliente.
 */
export function quantidadeConfirmada(item: {
  quantidade: number | null;
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
}): number | null {
  if (item.disponivel === null) return item.quantidade ?? 0;
  if (item.disponivel && item.quantidade === null && item.quantidadeDisponivel === null) return null;
  return item.quantidadeDisponivel ?? item.quantidade ?? 0;
}

/** O item genérico na tela: "Genérico", ou "Genérico: mudas nativas" quando tem observação. */
export function rotuloGenerico(observacao: string | null | undefined): string {
  const texto = observacao?.trim();
  return texto ? `Genérico: ${texto}` : 'Genérico';
}

/**
 * A fase como a linha do tempo da ficha a conta: o que aconteceu naquele dia,
 * e não o nome da situação. "Orçamento" é o que o pedido é; "Cadastrado" é o
 * que aconteceu com ele.
 */
export const ROTULO_HISTORICO: Record<SituacaoPedido, string> = {
  cadastrado: 'Cadastrado',
  verificando: 'Em verificação',
  verificado: 'Verificado',
  pendente_alteracao: 'Alteração solicitada',
  aprovado: 'Aprovado',
  separando: 'Separando',
  pronto_envio: 'Pronto para envio',
  cancelado: 'Cancelado',
};

/** O item como a aprovação o lê: o pedido e o que a conferência achou. */
export interface ItemParaAprovar extends ItemCalculavel {
  id: string;
  generico: boolean;
  recipienteId: string | null;
  recipienteDisponivelId?: string | null;
}

export interface CamposFaltando {
  quantidade: boolean;
  recipiente: boolean;
  preco: boolean;
  /** O genérico que a gerência ainda não compôs. */
  composicao: boolean;
}

/**
 * O que falta no item para a aprovação passar, **com a mesma regra de
 * `confirmarPedido`**: só o item vendável é cobrado, e valem os valores depois
 * de a aprovação consumir a conferência (o parcial passa a valer pelo que
 * existe, o recipiente conferido substitui o pedido). É o que a grade marca como
 * "Definir" e o que o botão de aprovar lista antes de alguém tocar nele.
 */
export function camposFaltando(item: ItemParaAprovar, itens: readonly ItemParaAprovar[]): CamposFaltando {
  const composicao = item.generico && !itens.some((outro) => outro.itemPaiId === item.id);
  if (!itemVendavel(item, itens)) return { quantidade: false, recipiente: false, preco: false, composicao };
  const parcial = item.disponivel === false && (item.quantidadeDisponivel ?? 0) > 0;
  const quantidade = parcial ? item.quantidadeDisponivel! : item.quantidade;
  return {
    quantidade: quantidade === null,
    recipiente: !item.generico && (item.recipienteDisponivelId ?? item.recipienteId) === null,
    preco: item.precoCentavos === null,
    composicao,
  };
}

/**
 * O que impede a aprovação, numa frase: "Falta preço em 2 itens e recipiente
 * em 1 item." Nulo quando nada falta.
 */
export function resumoFaltas(itens: readonly ItemParaAprovar[]): string | null {
  const contagem = { preco: 0, quantidade: 0, recipiente: 0, composicao: 0 };
  for (const item of itens) {
    const falta = camposFaltando(item, itens);
    for (const campo of Object.keys(contagem) as (keyof typeof contagem)[]) if (falta[campo]) contagem[campo]++;
  }
  const nomes: Record<keyof typeof contagem, string> = {
    preco: 'preço',
    quantidade: 'quantidade',
    recipiente: 'recipiente',
    composicao: 'espécies do genérico',
  };
  const partes = (Object.keys(contagem) as (keyof typeof contagem)[])
    .filter((campo) => contagem[campo] > 0)
    .map((campo) => `${nomes[campo]} em ${contagem[campo]} ${contagem[campo] === 1 ? 'item' : 'itens'}`);
  if (partes.length === 0) return null;
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`;
  return `Falta ${lista}.`;
}

/** O total que a tela imprime: "R$ 1.250,00" ou "a definir" enquanto faltar preço. */
export function formatTotal(centavos: number | null): string {
  return centavos === null ? 'a definir' : formatMoeda(centavos);
}

/**
 * RF-58: o filtro da lista de pedidos, que corre enquanto se digita. Com um
 * cliente tocado na lista, vale o id: dois clientes podem ter nome parecido.
 * Sem ele, vale o texto, em pedaços soltos e sem acento, como na busca de espécie.
 */
export function filtraPedidosPorCliente<T extends { clienteId: string; cliente: string }>(
  pedidos: readonly T[],
  filtro: { clienteId: string; texto: string },
): T[] {
  if (filtro.clienteId) return pedidos.filter((pedido) => pedido.clienteId === filtro.clienteId);
  const termos = normalizeTexto(filtro.texto).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return [...pedidos];
  return pedidos.filter((pedido) => {
    const nome = normalizeTexto(pedido.cliente);
    return termos.every((termo) => nome.includes(termo));
  });
}

// ------------------------------------------------------------
// Verificação de disponibilidade (T8.9)
// ------------------------------------------------------------

/** O que a gerência responde sobre um item, andando no pátio: "Tem tudo", "Tem parte" ou "Não tem". */
export type EstadoDisponibilidade = 'disponivel' | 'parcial' | 'indisponivel';

/** As colunas de `pedidos_itens` que a resposta grava. */
export interface Disponibilidade {
  disponivel: boolean;
  quantidadeDisponivel: number | null;
  recipienteDisponivelId: string | null;
  alturaDisponivelM: number | null;
}

/** O que o cliente especificou no item: é o que a conferência compara. */
export interface ItemParaResponder {
  /** Nula quando o cliente não disse quantas. */
  quantidade: number | null;
  /** Nulo quando o cliente não disse o tamanho. */
  recipienteId: string | null;
  /** Nula quando o cliente não pediu altura, que é o caso comum. */
  alturaM: number | null;
}

export type CampoConferido = 'quantidade' | 'recipiente' | 'altura';

export interface Pergunta {
  campo: CampoConferido;
  obrigatorio: boolean;
}

export interface PerguntasDoItem {
  /** Só há "parte" do que foi especificado: o item sem nada especificado não tem este botão. */
  temParte: boolean;
  /** "Tem tudo", ou só "Tem" quando o cliente não especificou nada. */
  rotuloTudo: 'Tem tudo' | 'Tem';
  /** Os campos do painel de "Tem tudo" (ou de cada espécie, no genérico). */
  tudo: readonly Pergunta[];
  /** Os campos do painel de "Tem parte", já preenchidos com o pedido. */
  parte: readonly Pergunta[];
}

/**
 * P12: **uma regra só para os 16 tipos de item** (espécie ou genérico, com ou
 * sem recipiente, altura e quantidade), para a tela e o servidor perguntarem o
 * mesmo.
 *
 * - **Tem tudo** é "bate com tudo o que o cliente especificou", e pergunta só o
 *   que falta para fechar a venda: o recipiente, se não veio (obrigatório,
 *   porque a aprovação o exige), e a quantidade, se não veio (opcional: a
 *   chefia acerta na negociação).
 * - **Tem parte** é "algo do que foi especificado não bate", e pergunta tudo o
 *   que foi especificado, mais o que "Tem tudo" perguntaria. Altura que o
 *   cliente não pediu nunca é perguntada.
 * - **No genérico, cada espécie é uma linha**, e a quantidade de cada uma é
 *   perguntada mesmo em "Tem tudo": "500 nativas" precisa saber quantas de cada.
 */
export function perguntasDoItem(item: ItemParaResponder, generico = false): PerguntasDoItem {
  const temQuantidade = item.quantidade !== null;
  const quantidade: Pergunta = { campo: 'quantidade', obrigatorio: temQuantidade };
  const recipiente: Pergunta = { campo: 'recipiente', obrigatorio: true };

  const tudo: Pergunta[] = [];
  if (generico || !temQuantidade) tudo.push(quantidade);
  if (!item.recipienteId) tudo.push(recipiente);

  const parte: Pergunta[] = [quantidade, recipiente];
  if (item.alturaM !== null) parte.push({ campo: 'altura', obrigatorio: true });

  const temParte = temQuantidade || item.recipienteId !== null || item.alturaM !== null;
  return { temParte, rotuloTudo: temParte ? 'Tem tudo' : 'Tem', tudo, parte };
}

function quantidadeInvalida(valor: number | null | undefined): boolean {
  return valor !== null && valor !== undefined && (!Number.isInteger(valor) || valor < 1);
}

export const NADA_DIFERE = 'Nada difere do pedido.';

/**
 * A resposta de um item específico vira colunas. **Parcial e indisponível
 * compartilham `disponivel = false`** quando falta quantidade, e quem os
 * distingue é o número: zero é "não tem nenhuma". É a forma do CHECK
 * `pedidos_itens_disponibilidade_coerente`.
 *
 * **Conferido igual ao pedido não é informação**: recipiente e altura só são
 * gravados quando diferem, e é isso que deixa a aprovação copiá-los por cima do
 * pedido sem apagar nada (`confirmarPedido`).
 *
 * "Tem parte" com a quantidade inteira é válido quando o recipiente ou a altura
 * diferem ("tem as 500, mas em 17x22"), e fica `disponivel = true`.
 */
export function resolveDisponibilidade(
  estado: EstadoDisponibilidade,
  item: ItemParaResponder,
  extras: { quantidade?: number | null; recipienteId?: string | null; alturaM?: number | null } = {},
): { error: string } | { value: Disponibilidade } {
  if (estado === 'indisponivel') {
    return { value: { disponivel: false, quantidadeDisponivel: 0, recipienteDisponivelId: null, alturaDisponivelM: null } };
  }

  const perguntas = perguntasDoItem(item);
  if (estado === 'parcial' && !perguntas.temParte) {
    return { error: 'O pedido não especifica nada para comparar: use "Tem".' };
  }

  const recipiente = extras.recipienteId || item.recipienteId;
  if (!recipiente) return { error: 'Escolha o recipiente em que a muda está.' };
  // "Tem tudo" num item com recipiente é o recipiente do pedido
  const recipienteConferido =
    estado === 'parcial' || !item.recipienteId ? (recipiente !== item.recipienteId ? recipiente : null) : null;

  const informada = extras.quantidade ?? null;
  if (quantidadeInvalida(informada)) {
    return { error: 'Informe quantas mudas existem, um número inteiro maior que zero.' };
  }

  if (estado === 'disponivel') {
    // Com quantidade no pedido, "tem tudo" é ela; sem, o número é opcional
    const quantidadeDisponivel = item.quantidade === null ? informada : null;
    return {
      value: { disponivel: true, quantidadeDisponivel, recipienteDisponivelId: recipienteConferido, alturaDisponivelM: null },
    };
  }

  let quantidadeDisponivel: number | null = informada;
  if (item.quantidade !== null) {
    if (informada === null) return { error: 'Informe quantas mudas existem, um número inteiro maior que zero.' };
    if (informada > item.quantidade) {
      return { error: `Tem parte não passa do pedido: são ${item.quantidade} mudas.` };
    }
    // A quantidade inteira não é número a gravar: "tem as 500" é disponível
    quantidadeDisponivel = informada < item.quantidade ? informada : null;
  }

  const altura = item.alturaM === null ? null : (extras.alturaM ?? item.alturaM);
  const alturaConferida = altura !== null && altura !== item.alturaM ? altura : null;

  const faltaMuda = item.quantidade !== null && quantidadeDisponivel !== null;
  const outroRecipiente = item.recipienteId !== null && recipienteConferido !== null;
  if (!faltaMuda && !outroRecipiente && alturaConferida === null) return { error: NADA_DIFERE };

  return {
    value: {
      disponivel: !faltaMuda,
      quantidadeDisponivel,
      recipienteDisponivelId: recipienteConferido,
      alturaDisponivelM: alturaConferida,
    },
  };
}

/** A segunda linha de "Tem parte": o que completa o pedido em outro recipiente. */
export interface ComplementoConferido {
  quantidade: number;
  recipienteId: string;
  /** Nula quando o cliente não pediu altura. */
  alturaM: number | null;
}

/**
 * P13: "Tem parte" com o "+". O saco pedido não tem a quantidade toda, e o
 * viveiro oferece completar com outro ("tem 300 em 17x22 + 200 em 20x26").
 *
 * **O complemento é um item próprio**, da mesma espécie e sem preço, porque
 * saco diferente tem preço diferente e é a chefia quem o digita. Por isso ele
 * exige o que um item vendável exige: quantas e em que recipiente.
 *
 * **Completar não passa do pedido**: a soma das duas linhas vai até a
 * quantidade pedida. E o complemento tem de diferir da linha principal em
 * recipiente ou altura, senão é a mesma linha escrita duas vezes.
 */
export function resolveComplemento(
  item: ItemParaResponder,
  principal: { quantidade?: number | null; recipienteId?: string | null; alturaM?: number | null },
  complemento: { quantidade?: number | null; recipienteId?: string | null; alturaM?: number | null },
): { error: string } | { value: ComplementoConferido } {
  if (item.quantidade === null) return { error: 'Só se completa o item que tem quantidade pedida.' };
  const quantidade = complemento.quantidade ?? null;
  if (quantidade === null || quantidadeInvalida(quantidade)) {
    return { error: 'Informe quantas mudas completam, um número inteiro maior que zero.' };
  }
  if (!complemento.recipienteId) return { error: 'Escolha o recipiente do complemento.' };

  const soma = (principal.quantidade ?? 0) + quantidade;
  if (soma > item.quantidade) {
    return { error: `As duas linhas passam do pedido: são ${item.quantidade} mudas.` };
  }

  const alturaPrincipal = item.alturaM === null ? null : (principal.alturaM ?? item.alturaM);
  const altura = item.alturaM === null ? null : (complemento.alturaM ?? item.alturaM);
  const recipientePrincipal = principal.recipienteId || item.recipienteId;
  if (complemento.recipienteId === recipientePrincipal && altura === alturaPrincipal) {
    return { error: 'O complemento é igual à primeira linha: troque o recipiente ou some as duas.' };
  }

  return { value: { quantidade, recipienteId: complemento.recipienteId, alturaM: altura } };
}

/** Como a tela pinta o item: branco é o que ainda não foi olhado. */
export type EstadoDaResposta = 'pendente' | 'nao_tem' | 'parte' | 'tudo';

/**
 * O estado sai das colunas, e não de uma coluna própria: "parte" é ter menos
 * mudas que o pedido, ou tê-las com recipiente ou altura diferente do que o
 * cliente especificou. No item sem recipiente, o recipiente conferido é o que
 * faltava, e não uma diferença.
 */
export function estadoDaResposta(item: {
  recipienteId: string | null;
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
  recipienteDisponivelId: string | null;
  alturaDisponivelM: number | null;
}): EstadoDaResposta {
  if (item.disponivel === null) return 'pendente';
  if (!item.disponivel && !item.quantidadeDisponivel) return 'nao_tem';
  if (!item.disponivel) return 'parte';
  const outroRecipiente = item.recipienteId !== null && item.recipienteDisponivelId !== null;
  return outroRecipiente || item.alturaDisponivelM !== null ? 'parte' : 'tudo';
}

/** Uma espécie escolhida para compor um item genérico, como chega da tela. */
export interface LinhaComposicao {
  especieId: string;
  /** Vazio herda o do genérico. */
  recipienteId: string | null;
  /** Nula só no genérico sem quantidade, onde é opcional. */
  quantidade: number | null;
  /** Nula ou ausente herda a do genérico. */
  alturaM?: number | null;
}

/** A linha pronta para gravar: o que foi herdado do genérico já está preenchido. */
export interface LinhaComposta {
  especieId: string;
  recipienteId: string;
  quantidade: number | null;
  alturaM: number | null;
}

/** O genérico composto: as linhas e a resposta que o pai grava. */
export interface ComposicaoValidada {
  linhas: readonly LinhaComposta[];
  disponivel: boolean;
  quantidadeDisponivel: number | null;
}

/**
 * A composição do item genérico: quais espécies atendem "500 mudas nativas".
 *
 * **Em "Tem tudo", a soma tem de fechar exatamente**, e recipiente e altura
 * pedidos valem para toda linha. Menos que o pedido entregaria menos do que foi
 * vendido; mais entregaria muda que ninguém comprou. **Em "Tem parte"**, a soma
 * pode ficar abaixo, ou fechar com alguma espécie em outro recipiente ou outra
 * altura. O escopo, quando o cliente deu um, é **bloqueio rígido**: a
 * compensação ambiental que exige cinco espécies do bioma não aceita a sexta.
 *
 * **Sem quantidade no pai não há soma**: "manda o que tiver" é a gerência
 * montando a lista, cada linha é uma venda própria, e quantas de cada é
 * opcional, como no item específico.
 */
export function validarComposicaoGenerico(
  pai: ItemParaResponder,
  linhas: readonly LinhaComposicao[],
  permitidas: readonly string[] = [],
  estado: Exclude<EstadoDisponibilidade, 'indisponivel'> = 'disponivel',
): { error: string } | { value: ComposicaoValidada } {
  if (linhas.length === 0) return { error: 'Escolha ao menos uma espécie para compor o item.' };
  if (estado === 'parcial' && !perguntasDoItem(pai, true).temParte) {
    return { error: 'O pedido não especifica nada para comparar: use "Tem".' };
  }

  const compostas: LinhaComposta[] = [];
  let difere = false;
  for (const [indice, linha] of linhas.entries()) {
    const posicao = `linha ${indice + 1}`;
    if (!linha.especieId) return { error: `Escolha a espécie da ${posicao}.` };
    if (permitidas.length > 0 && !permitidas.includes(linha.especieId)) {
      return { error: `A espécie da ${posicao} não está entre as que o cliente aceita.` };
    }

    const recipienteId = estado === 'disponivel' && pai.recipienteId ? pai.recipienteId : linha.recipienteId || pai.recipienteId;
    if (!recipienteId) return { error: `Escolha o recipiente da ${posicao}.` };

    if (pai.quantidade !== null && linha.quantidade === null) {
      return { error: `Informe a quantidade da ${posicao}, um número inteiro maior que zero.` };
    }
    if (quantidadeInvalida(linha.quantidade)) {
      return { error: `Informe a quantidade da ${posicao}, um número inteiro maior que zero.` };
    }

    const alturaM = estado === 'disponivel' || pai.alturaM === null ? pai.alturaM : (linha.alturaM ?? pai.alturaM);
    if (pai.recipienteId && recipienteId !== pai.recipienteId) difere = true;
    if (alturaM !== pai.alturaM) difere = true;
    compostas.push({ especieId: linha.especieId, recipienteId, quantidade: linha.quantidade, alturaM });
  }

  const soma = compostas.reduce((total, linha) => total + (linha.quantidade ?? 0), 0);
  if (pai.quantidade === null) {
    if (estado === 'parcial' && !difere) return { error: NADA_DIFERE };
    return { value: { linhas: compostas, disponivel: true, quantidadeDisponivel: null } };
  }

  if (soma > pai.quantidade) return { error: `Passou ${soma - pai.quantidade} mudas do que o item pede.` };
  if (estado === 'disponivel' && soma < pai.quantidade) {
    return { error: `Faltam ${pai.quantidade - soma} mudas para fechar o item.` };
  }
  if (estado === 'parcial' && soma === pai.quantidade && !difere) return { error: NADA_DIFERE };

  const falta = soma < pai.quantidade;
  return { value: { linhas: compostas, disponivel: !falta, quantidadeDisponivel: falta ? soma : null } };
}

/**
 * O estado do genérico na tela sai dos filhos: parte é soma abaixo do pedido,
 * ou alguma espécie em recipiente ou altura diferente do que o cliente pediu.
 */
export function estadoDoGenerico(
  pai: ItemParaResponder & { disponivel: boolean | null; quantidadeDisponivel: number | null },
  filhos: readonly { recipienteId: string | null; alturaM: number | null }[],
): EstadoDaResposta {
  if (pai.disponivel === null) return 'pendente';
  if (!pai.disponivel && !pai.quantidadeDisponivel) return 'nao_tem';
  if (!pai.disponivel) return 'parte';
  const difere = filhos.some(
    (filho) =>
      (pai.recipienteId !== null && filho.recipienteId !== pai.recipienteId) ||
      (pai.alturaM !== null && filho.alturaM !== pai.alturaM),
  );
  return difere ? 'parte' : 'tudo';
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
