/**
 * As linhas da planilha de itens do pedido (no cadastro e na ficha), e o que a colagem faz com
 * elas. Puro, sem React e sem SQL: é a parte que o teste consegue olhar sem
 * montar tela nenhuma.
 */
import { formatQuantidade } from '@/lib/lotes-rotulos';
import {
  type FaixaDeAltura,
  type SaldoDoItem,
  chaveSaldo,
  estadoDaResposta,
  estadoDoGenerico,
  formatAltura,
  normalizaCampoAltura,
  quantidadeConfirmada,
  rotuloGenerico,
} from '@/lib/pedidos-rotulos';
import {
  type EspecieParaColagem,
  type RecipienteParaColagem,
  casaEspecie,
  casaRecipiente,
} from '@/lib/pedidos-colagem';

/** O que a verificação achou do item, como a grade pinta: verde, amarelo ou vermelho. */
export type Conferencia = 'tudo' | 'parte' | 'nao_tem';

/**
 * A barra no começo da linha. É sombra interna, e não borda, para não empurrar
 * a coluna: as linhas com e sem barra continuam alinhadas.
 */
export const BARRA_CONFERENCIA: Record<Conferencia | 'pedido', string> = {
  tudo: 'shadow-[inset_5px_0_0_var(--color-green-600)]',
  parte: 'shadow-[inset_5px_0_0_var(--color-amber-400)]',
  nao_tem: 'shadow-[inset_5px_0_0_var(--color-red-600)]',
  pedido: 'shadow-[inset_5px_0_0_var(--color-blue-500)]',
};

/** A linha pai do item dividido: o que o cliente pediu, sem campo, em cinza escuro. */
export const CLASSE_LINHA_PAI = `bg-gray-700 text-white ${BARRA_CONFERENCIA.pedido}`;

/** A célula que a aprovação ainda cobra: vazia, sem texto, com fundo vermelho claro. */
export const CLASSE_OBRIGATORIO = 'bg-red-50';

/** O texto que o leitor de tela lê na célula obrigatória vazia. */
export const TEXTO_OBRIGATORIO = 'Obrigatório preencher';

interface ItemConferido {
  id: string;
  generico: boolean;
  itemPaiId?: string | null;
  complementaItemId?: string | null;
  quantidade: number | null;
  recipienteId: string | null;
  alturaM: number | null;
  disponivel?: boolean | null;
  quantidadeDisponivel?: number | null;
  recipienteDisponivelId?: string | null;
  alturaDisponivelM?: number | null;
}

/**
 * A cor do item, ou nulo enquanto a verificação não olhou. A espécie que compõe
 * o genérico e o complemento do item dividido são o que tem, e são verdes: o
 * amarelo fica no item que não deu conta sozinho.
 */
export function conferenciaDoItem(item: ItemConferido, itens: readonly ItemConferido[]): Conferencia | null {
  if (item.itemPaiId) return 'tudo';
  if (item.complementaItemId && itens.some((outro) => outro.id === item.complementaItemId)) return 'tudo';
  const respondido = {
    ...item,
    disponivel: item.disponivel ?? null,
    quantidadeDisponivel: item.quantidadeDisponivel ?? null,
    recipienteDisponivelId: item.recipienteDisponivelId ?? null,
    alturaDisponivelM: item.alturaDisponivelM ?? null,
  };
  const estado = item.generico
    ? estadoDoGenerico(
        respondido,
        itens.filter((filho) => filho.itemPaiId === item.id),
      )
    : estadoDaResposta(respondido);
  return estado === 'pendente' ? null : estado;
}

interface ItemFaltante extends ItemConferido {
  especie: string | null;
  especificacao: string | null;
  suplente?: boolean;
}

/**
 * "Copiar faltantes": o que a verificação não achou, uma linha por item, como
 * "4 - Ipê - 1,20 m". Recipiente não entra, e o que o cliente não especificou
 * some da linha.
 *
 * - **Não tem** entra inteiro, como foi pedido.
 * - **Tem parte** entra só com o que faltou de quantidade: o pedido menos o
 *   confirmado e os complementos. Ter as mudas em outro recipiente ou outra
 *   altura não é falta, e o item sem quantidade pedida nunca falta em parte.
 * - O suplente não é item (P18): nem entra, nem completa o principal.
 */
export function faltantesDoPedido(itens: readonly ItemFaltante[]): string[] {
  const reais = itens.filter((item) => !item.suplente);
  const faltantes: string[] = [];
  for (const item of reais) {
    const estado = conferenciaDoItem(item, reais);
    if (estado !== 'nao_tem' && estado !== 'parte') continue;

    let quantas = item.quantidade;
    if (estado === 'parte') {
      if (item.quantidade === null) continue;
      const confirmada = quantidadeConfirmada({
        quantidade: item.quantidade,
        disponivel: item.disponivel ?? null,
        quantidadeDisponivel: item.quantidadeDisponivel ?? null,
      });
      const complementos = reais
        .filter((outro) => outro.complementaItemId === item.id)
        .reduce((soma, outro) => soma + (outro.quantidade ?? 0), 0);
      quantas = item.quantidade - (confirmada ?? item.quantidade) - complementos;
      if (quantas <= 0) continue;
    }

    const nome = item.generico ? rotuloGenerico(item.especificacao) : (item.especie ?? '');
    faltantes.push(
      [quantas === null ? null : formatQuantidade(quantas), nome, formatAltura(item.alturaM) || null]
        .filter(Boolean)
        .join(' - '),
    );
  }
  return faltantes;
}

/** O que a grade do orçamento mostra da verificação, por linha: a cor e a frase miúda. */
export interface ConferenciaDaLinha {
  estado: Conferencia;
  resumo: string;
  /** Quantas a verificação contou, quando deu número: é com ela que a grade diz quanto falta. */
  confirmada?: number | null;
}

/** Linha só de leitura na grade do orçamento: o pedido original do item dividido, ou a espécie do genérico. */
export interface LinhaLeitura {
  id: string;
  nome: string;
  recipiente: string | null;
  altura: string | null;
  quantidade: number | null;
  /** Só na linha pai: "Temos 30 de 50". */
  temos?: string;
  completo?: boolean;
}

/**
 * "Verificação: tem 30 em 17x22 · 1,20 m". O recipiente e a altura entram
 * quando a verificação os disse; o "Não tem" é a frase inteira.
 */
export function resumoDaConferencia(
  estado: Conferencia,
  item: {
    generico: boolean;
    quantidade: number | null;
    quantidadeDisponivel?: number | null;
    recipienteDisponivel?: string | null;
    alturaDisponivelM?: number | null;
  },
  especiesNoGenerico = 0,
): string {
  if (estado === 'nao_tem') return 'Verificação: não tem';
  if (item.generico) {
    return especiesNoGenerico > 0
      ? `Verificação: montado com ${especiesNoGenerico} ${especiesNoGenerico === 1 ? 'espécie' : 'espécies'}`
      : 'Verificação: tem';
  }
  const quantas = item.quantidadeDisponivel ?? (estado === 'tudo' ? item.quantidade : null);
  const partes = [
    `Verificação: tem${quantas === null ? '' : ` ${formatQuantidade(quantas)}`}${
      item.recipienteDisponivel ? ` em ${item.recipienteDisponivel}` : ''
    }`,
    item.alturaDisponivelM ? formatAltura(item.alturaDisponivelM) : null,
  ];
  return partes.filter(Boolean).join(' · ');
}

/** O estoque disponível de cada par espécie e recipiente, por altura, lido na abertura da tela. */
export type SaldosPorChave = Record<string, FaixaDeAltura[]>;

interface SaldoDaFaixa extends FaixaDeAltura {
  especieId: string;
  recipienteId: string;
}

/**
 * RF-62: o estoque disponível agrupado por par espécie e recipiente. Vai à tela
 * por altura, e não somado, porque a altura do item muda enquanto a pessoa
 * digita, e é ela que decide quais lotes atendem (RN-10).
 */
export function montarSaldos(faixas: readonly SaldoDaFaixa[]): SaldosPorChave {
  const saldos: SaldosPorChave = {};
  for (const { especieId, recipienteId, alturaM, quantidade } of faixas) {
    const chave = chaveSaldo(especieId, recipienteId);
    (saldos[chave] ??= []).push({ alturaM, quantidade });
  }
  return saldos;
}

/**
 * Quantas mudas a verificação contou para o item, ou nulo quando ela não olhou
 * o item ou não deu número (o genérico, o "Tem" sem quantidade). É o que vale
 * no lugar do saldo para dizer quanto falta: a contagem no canteiro é mais nova
 * que o estoque do sistema.
 */
export function confirmadaNaVerificacao(item: {
  generico: boolean;
  quantidade: number | null;
  disponivel?: boolean | null;
  quantidadeDisponivel?: number | null;
}): number | null {
  if (item.generico || item.disponivel == null) return null;
  return quantidadeConfirmada({
    quantidade: item.quantidade,
    disponivel: item.disponivel,
    quantidadeDisponivel: item.quantidadeDisponivel ?? null,
  });
}

/** Quanto falta do pedido: menos o que a verificação contou, ou, sem ela, menos o saldo. */
export function faltaNoItem(saldo: SaldoDoItem, quantidade: number | null, confirmada: number | null = null): number {
  if (quantidade === null) return 0;
  return Math.max(0, quantidade - (confirmada ?? saldo.disponivel));
}

/**
 * A linha miúda embaixo do item: "Disponível: 120". Faltando, diz quanto falta
 * e, se o item pede altura, quanto há até 20 cm abaixo para completar e quanto
 * está sem altura medida (RN-11). Não recusa nada: só avisa (UC-31 FA-2).
 *
 * Depois da verificação, o que falta é o pedido menos o que ela contou
 * (`confirmada`), e não menos o saldo: "Tem parte, 3 de 10" faltam 7, mesmo
 * com o sistema dizendo zero.
 */
export function textoSaldo(saldo: SaldoDoItem, quantidade: number | null, confirmada: number | null = null): string {
  const partes = [`Disponível: ${formatQuantidade(saldo.disponivel)}`];
  const falta = faltaNoItem(saldo, quantidade, confirmada);
  if (falta > 0) {
    partes.push(`faltam ${formatQuantidade(falta)}`);
    if (saldo.abaixo > 0) partes.push(`${formatQuantidade(saldo.abaixo)} com até 20 cm a menos`);
    if (saldo.semAltura > 0) partes.push(`${formatQuantidade(saldo.semAltura)} sem altura medida`);
  }
  return partes.join(' · ');
}

export interface Linha {
  chave: number;
  generico: boolean;
  especieId: string;
  /** O que o cliente pediu, no item genérico: "mudas nativas de 17x22". */
  especificacao: string;
  /** Vazio é "o cliente não disse o tamanho": a conferência responde. */
  recipienteId: string;
  /** Texto, porque o campo é controlado: a pessoa digita "120" e vê "1,20 m" ao sair do campo. */
  altura: string;
  quantidade: string;
  /**
   * No genérico, as espécies entre as quais o cliente aceita ("100 mudas entre
   * araçá, ipê-amarelo e ingá-anão"). Vazio é "qualquer uma serve". A chave é
   * da linha da sublista, para o React não trocar o campo de uma pela outra.
   */
  grupo: LinhaGrupo[];
}

export interface LinhaGrupo {
  chave: number;
  especieId: string;
}

/** O que `onAlterar` grava num campo da linha. */
export type ValorLinha = string | boolean | LinhaGrupo[];

/** As espécies do grupo que vão ao servidor: só no genérico, sem linha em branco e sem repetida. */
export function especiesDoGrupo(linha: Pick<Linha, 'generico' | 'grupo'>): string[] {
  if (!linha.generico) return [];
  return [...new Set(linha.grupo.map((item) => item.especieId).filter(Boolean))];
}

/** A ordem das colunas na tela, que é também a ordem em que a colagem cai. */
export const COLUNAS = ['especie', 'recipiente', 'altura', 'quantidade'] as const;
export type Coluna = (typeof COLUNAS)[number];

export interface Celula {
  linha: number;
  coluna: number;
}

export function linhaVazia(chave: number): Linha {
  return { chave, generico: false, especieId: '', especificacao: '', recipienteId: '', altura: '', quantidade: '', grupo: [] };
}

export function estaVazia(linha: Linha): boolean {
  return (
    !linha.generico &&
    !linha.especieId &&
    !linha.especificacao.trim() &&
    !linha.recipienteId &&
    !linha.altura.trim() &&
    !linha.quantidade.trim()
  );
}

export function proximaChave(atuais: readonly Linha[]): number {
  return Math.max(0, ...atuais.map((linha) => linha.chave)) + 1;
}

/** "1.000" e "1 000" da planilha viram "1000"; o que não for número fica como veio. */
function lerQuantidadeCelula(texto: string): string {
  const digitos = texto.replace(/[.,\s]/g, '');
  return /^\d+$/.test(digitos) ? digitos : texto;
}

/**
 * As células coladas caindo na planilha a partir da que está em foco, como numa
 * planilha de verdade: cada tabulação anda uma coluna, cada quebra de linha
 * anda uma linha, e o que passar do fim da tabela vira linha nova.
 *
 * **O que não casa fica em branco, e não é chutado.** Espécie só entra se o
 * nome for reconhecido, e recipiente só se não houver dúvida: célula em branco
 * é pergunta visível na tela, enquanto espécie errada passaria despercebida.
 */
export function aplicarColagemTabular(
  linhas: readonly Linha[],
  inicio: Celula,
  celulas: readonly (readonly string[])[],
  especies: readonly EspecieParaColagem[],
  recipientes: readonly RecipienteParaColagem[],
): Linha[] {
  const resultado = linhas.map((linha) => ({ ...linha }));
  let chave = proximaChave(resultado);

  celulas.forEach((celulasDaLinha, deslocamento) => {
    const indice = inicio.linha + deslocamento;
    while (resultado.length <= indice) resultado.push(linhaVazia(chave++));
    const linha = resultado[indice];

    celulasDaLinha.forEach((texto, passo) => {
      const coluna = COLUNAS[inicio.coluna + passo];
      if (!coluna || texto === '') return;

      if (coluna === 'especie') {
        const casamento = casaEspecie(texto, especies);
        linha.especieId = casamento.especieId ?? '';
        linha.generico = false;
        linha.grupo = [];
      } else if (coluna === 'recipiente') {
        linha.recipienteId = casaRecipiente(texto, recipientes) ?? '';
      } else if (coluna === 'altura') {
        linha.altura = normalizaCampoAltura(texto);
      } else {
        linha.quantidade = lerQuantidadeCelula(texto);
      }
    });
  });

  return resultado;
}
