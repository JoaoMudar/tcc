/**
 * A lista que o cliente mandou pelo WhatsApp, lida linha a linha e casada com o
 * catálogo. Puro, sem SQL e sem `pg` (RNF-11, TA-60): o formulário do pedido já
 * carrega as espécies ativas, e o reconhecimento acontece enquanto a pessoa
 * olha a tela, sem uma ida ao servidor por linha.
 *
 * **Nada entra no pedido sem revisão humana.** O que está aqui é palpite bem
 * informado; quem cadastra confirma, corrige ou descarta cada linha.
 */
import { normalizeNomePopular } from './especies-nomes';
import { parseAltura } from './pedidos-rotulos';

export interface LinhaLida {
  /** O trecho como o cliente escreveu, para a revisão mostrar de onde veio. */
  bruta: string;
  /** Vazio quando o trecho só trouxe tamanho ou preço: a espécie se escolhe na revisão. */
  nome: string;
  quantidade: number | null;
  /** Altura em metros; da faixa "80–100 cm" fica o menor valor. */
  alturaM: number | null;
  /**
   * O preço que veio na lista, em centavos. **Não entra no pedido** (RN-50): é
   * lido para não virar nome nem quantidade, e para a revisão mostrar que foi
   * visto e deixado de lado.
   */
  precoCentavos: number | null;
  /** O recipiente como veio escrito ("tubete", "17x22"), casado depois com o cadastro. */
  recipiente: string | null;
}

export interface EspecieParaColagem {
  id: string;
  /** Como a espécie aparece na tela: o nome popular principal, ou o científico. */
  nome: string;
  nomeCientifico?: string | null;
  nomesPopulares?: readonly string[];
}

export type SituacaoCasamento = 'exata' | 'provavel' | 'nenhuma';

export interface Casamento {
  situacao: SituacaoCasamento;
  especieId: string | null;
  especie: string | null;
  /** 0 a 1. Serve para ordenar palpites e para o teste enxergar a decisão. */
  pontos: number;
  /** O nome que casou, quando não foi o principal: "reconhecido por X". */
  casouPor?: string | null;
}

export interface LinhaColada extends LinhaLida {
  casamento: Casamento;
  /** O recipiente escrito na lista, quando o cadastro o reconhece sem dúvida. */
  recipienteId: string | null;
}

/** Abaixo disto o palpite não ajuda: mostrar espécie errada é pior que não mostrar nenhuma. */
const LIMITE_PROVAVEL = 0.6;

/** Um nome contido no outro é palpite forte, ainda que os bigramas não digam isso. */
const PONTOS_CONTEM = 0.85;

/** Marcadores de lista: "- ", "* ", "• ", "· ", travessões, "1) ", "1. ". */
const MARCADOR_LISTA = /^\s*(?:[-*•·–—]|\d{1,2}[.)])\s+/;

/** Unidades grudadas na quantidade, que são ignoradas: "500un", "500 mudas", "20 pçs". */
const SUFIXO_UNIDADE = '(?:un|und|unds?|unid(?:ades?)?|mudas?|p(?:c|ç)s?|p(?:c|ç)as?)?';

/** Teto por trecho colado: higiene de entrada, nenhum caso real chega perto. */
const MAX_CARACTERES_LINHA = 200;

/** Teto de itens por colagem: o mesmo que o pedido aceita num envio. */
export const MAX_ITENS_COLAGEM = 200;

/** A quantidade solta depois do tamanho só é quantidade daqui para cima; abaixo, é o preço do formato enxuto. */
const QUANTIDADE_SOLTA_MINIMA = 100;

/*
 * Os pedaços que a lista traz além do nome. Cada um é tirado do trecho antes do
 * seguinte, e nenhum tem quantificador dentro de quantificador (SEC-004): o
 * trecho já chega cortado em 200 caracteres, e o motor não tem como se perder.
 */
const NUMERO = String.raw`\d+(?:[.,]\d{1,2})?`;
/** A unidade da altura, sem engolir "mudas": depois dela não vem letra. */
const UNIDADE_ALTURA = String.raw`(cm|cent[ií]metros?|mts?|metros?|m)(?![a-zà-ÿ])`;
const PRECO_COM_MOEDA = /R\$\s*(\d[\d.,]*)/i;
const RECIPIENTE = /(?:sacos?\s*)?(?<!\d)\d{2}\s*[x×]\s*\d{2}(?!\d)|\b(?:tubetes?|baldes?)\b/i;
const FAIXA_ALTURA = new RegExp(
  String.raw`(?<![\d.,])(${NUMERO})\s*(?:[-–]|a|até)\s*(${NUMERO})\s*${UNIDADE_ALTURA}`,
  'i',
);
const ALTURA = new RegExp(String.raw`(?<![\d.,])(${NUMERO})\s*${UNIDADE_ALTURA}`, 'i');
/** "12,00" sem "R$" é preço: a vírgula com dois decimais não é milhar nem quantidade. */
const PRECO_SEM_MOEDA = /(?<![\d.,])\d+,\d{2}(?![\d.,])/;

type Grupo = { alturaM: number | null; precoCentavos: number | null };

/** "1.000" e "1,000" são milhar; "12,5" e "12,50" são centavos. */
function lerPrecoColado(token: string): number | null {
  const partes = token.match(/^(\d{1,7}(?:[.,]\d{3})*)(?:[.,](\d{1,2}))?$/);
  if (!partes) return null;
  const reais = Number.parseInt(partes[1].replace(/[.,]/g, ''), 10);
  const centavos = Number.parseInt((partes[2] ?? '0').padEnd(2, '0'), 10);
  return reais * 100 + centavos;
}

/** O número com a unidade da lista, pela mesma regra do campo de altura. */
function lerAlturaColada(numero: string, unidade: string): number | null {
  const lida = parseAltura(`${numero} ${/^c/i.test(unidade) ? 'cm' : 'm'}`);
  return 'error' in lida ? null : lida.value;
}

/** Tira o primeiro pedaço que casar e devolve o casamento e o resto, com um espaço no lugar. */
function extrai(texto: string, padrao: RegExp): { casou: RegExpMatchArray | null; resto: string } {
  const casou = texto.match(padrao);
  if (!casou || casou.index === undefined) return { casou: null, resto: texto };
  return {
    casou,
    resto: `${texto.slice(0, casou.index)} ${texto.slice(casou.index + casou[0].length)}`,
  };
}

interface Medidas extends Grupo {
  recipiente: string | null;
  resto: string;
}

/** Preço, recipiente e altura saem do trecho; o que sobra é nome e quantidade. */
function extraiMedidas(trecho: string): Medidas {
  let resto = trecho;
  let precoCentavos: number | null = null;
  let alturaM: number | null = null;

  const moeda = extrai(resto, PRECO_COM_MOEDA);
  if (moeda.casou) {
    precoCentavos = lerPrecoColado(moeda.casou[1].replace(/[.,]$/, ''));
    resto = moeda.resto;
  }

  const recipienteLido = extrai(resto, RECIPIENTE);
  const recipiente = recipienteLido.casou ? recipienteLido.casou[0].replace(/\s+/g, ' ').trim() : null;
  resto = recipienteLido.resto;

  const faixa = extrai(resto, FAIXA_ALTURA);
  if (faixa.casou) {
    const [, de, ate, unidade] = faixa.casou;
    const menor = Math.min(Number(de.replace(',', '.')), Number(ate.replace(',', '.')));
    alturaM = lerAlturaColada(String(menor), unidade);
    resto = faixa.resto;
  } else {
    const altura = extrai(resto, ALTURA);
    if (altura.casou) {
      alturaM = lerAlturaColada(altura.casou[1], altura.casou[2]);
      resto = altura.resto;
    }
  }

  if (precoCentavos === null) {
    const semMoeda = extrai(resto, PRECO_SEM_MOEDA);
    if (semMoeda.casou) {
      precoCentavos = lerPrecoColado(semMoeda.casou[0]);
      resto = semMoeda.resto;
    }
  }

  // O travessão que separava os campos fica sozinho no meio do que sobrou
  resto = resto.replace(/\s[-–—]+(?=\s|$)/g, ' ');
  return { alturaM, precoCentavos, recipiente, resto };
}

/** "1.000", "1,000" e "500" viram inteiro positivo; o resto é nulo. */
function lerQuantidadeColada(token: string): number | null {
  const digitos = token.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digitos)) return null;
  const numero = Number.parseInt(digitos, 10);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function limpaNome(texto: string): string {
  return texto
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-:–—.x×]+|[\s\-:–—.x×]+$/gi, '')
    .trim();
}

/**
 * O número no FIM tem precedência sobre o do INÍCIO: "Ipê amarelo 500" é o jeito
 * mais comum de escrever, e "2x pitanga" é o outro. A linha sem número nenhum é
 * toda ela o nome, e a quantidade fica para a pessoa preencher.
 *
 * `solto` diz que o número do fim veio sem "x" e sem unidade: é o único que
 * pode ser preço no formato enxuto "Ipê 80cm 12".
 */
function separaNomeEQuantidade(linha: string): { nome: string; quantidade: number | null; solto: boolean } {
  // `[\s\-:–—xX×]*` já cobre o espaço: um `\s*` a mais fazia o motor testar toda divisão possível (SEC-004)
  const noFim = linha.match(new RegExp(`^(.+?)([\\s\\-:–—xX×]*)([\\d.,]+)\\s*(${SUFIXO_UNIDADE})\\s*$`, 'i'));
  if (noFim) {
    const quantidade = lerQuantidadeColada(noFim[3]);
    const nome = limpaNome(noFim[1]);
    if (quantidade !== null && nome) return { nome, quantidade, solto: !/[xX×]/.test(noFim[2]) && !noFim[4] };
  }
  const noInicio = linha.match(/^([\d.,]+)\s*[xX×]?\s*[-:.]?\s*(.+)$/);
  if (noInicio) {
    const quantidade = lerQuantidadeColada(noInicio[1]);
    const nome = limpaNome(noInicio[2]);
    if (quantidade !== null && nome) return { nome, quantidade, solto: false };
  }
  return { nome: limpaNome(linha), quantidade: null, solto: false };
}

/** O que um trecho diz, já sem o marcador de lista e sem o cabeçalho de grupo. */
function leTrecho(trecho: string, grupo: Grupo): Omit<LinhaLida, 'bruta'> {
  const medidas = extraiMedidas(trecho);
  const separado = separaNomeEQuantidade(medidas.resto.trim());
  let { nome, quantidade } = separado;
  let precoCentavos = medidas.precoCentavos;

  // Formato enxuto, "Ipê 80cm 12": depois do tamanho, o número solto pequeno é
  // preço. Na dúvida a quantidade fica em branco, que é pergunta visível na revisão
  if (
    medidas.alturaM !== null &&
    precoCentavos === null &&
    separado.solto &&
    quantidade !== null &&
    quantidade < QUANTIDADE_SOLTA_MINIMA
  ) {
    precoCentavos = quantidade * 100;
    quantidade = null;
  }
  // "80 cm" sozinho não tem nome: o número que sobrou não é espécie
  if (!/[a-zA-ZÀ-ɏ]/.test(nome)) nome = '';

  return {
    nome,
    quantidade,
    alturaM: medidas.alturaM ?? grupo.alturaM,
    precoCentavos: precoCentavos ?? grupo.precoCentavos,
    recipiente: medidas.recipiente,
  };
}

/**
 * "60 cm:" e "R$ 10,00:" são cabeçalho de grupo quando o que vem antes dos dois
 * pontos é só tamanho ou só preço. "guabiroba: 150" não é: ali o prefixo é nome.
 */
function leCabecalho(trecho: string): { grupo: Grupo; resto: string } | null {
  const partes = trecho.match(/^([^:]{1,40}):(.*)$/);
  if (!partes) return null;
  const medidas = extraiMedidas(partes[1]);
  if (medidas.alturaM === null && medidas.precoCentavos === null) return null;
  if (medidas.recipiente || /[\p{L}\d]/u.test(medidas.resto)) return null;
  return {
    grupo: { alturaM: medidas.alturaM, precoCentavos: medidas.precoCentavos },
    resto: partes[2].trim(),
  };
}

/**
 * Um item por trecho útil. A lista chega de muitos jeitos, e todos passam aqui:
 *
 * - uma espécie por linha, ou lista corrida separada por `|` ou `;`;
 * - com ou sem tamanho ("80 cm", "1,20 m", faixa "80–100 cm"), preço ("R$ 12,00")
 *   e recipiente ("tubete", "17x22"), em qualquer ordem;
 * - agrupada ("60 cm: Guabiroba"): o cabeçalho sozinho na linha vale para as de
 *   baixo, até o próximo;
 * - só tamanhos ou só preços: cada um vira uma linha sem espécie, para escolher.
 *
 * Vírgula não separa item: ela é o decimal de "12,00" e de "1,20 m".
 */
export function parseLinhasPedido(texto: string): LinhaLida[] {
  const lidas: LinhaLida[] = [];
  let grupo: Grupo = { alturaM: null, precoCentavos: null };

  for (const linha of texto.split(/\r?\n/)) {
    for (const original of linha.split(/[|;]/)) {
      if (lidas.length >= MAX_ITENS_COLAGEM) return lidas;
      // Nome de espécie com tamanho e preço não passa disso; o resto é colagem acidental
      const bruta = original.trim().slice(0, MAX_CARACTERES_LINHA);
      if (!bruta) continue;
      let trecho = bruta.replace(MARCADOR_LISTA, '');

      let grupoDoTrecho = grupo;
      const cabecalho = leCabecalho(trecho);
      if (cabecalho) {
        if (!cabecalho.resto) {
          grupo = cabecalho.grupo;
          continue;
        }
        grupoDoTrecho = cabecalho.grupo;
        trecho = cabecalho.resto;
      }

      const lida = leTrecho(trecho, grupoDoTrecho);
      if (!lida.nome && lida.alturaM === null && lida.precoCentavos === null) continue;
      lidas.push({ bruta, ...lida });
    }
  }
  return lidas;
}

/** Plural do jeito que o viveiro escreve: tira o "s" final de palavra com mais de três letras. */
function singulariza(texto: string): string {
  return texto
    .split(' ')
    .map((palavra) => (palavra.length > 3 && palavra.endsWith('s') ? palavra.slice(0, -1) : palavra))
    .join(' ');
}

/**
 * Sørensen-Dice por bigramas de caractere, de 0 a 1, ignorando espaços. É o que
 * faz "aracuaria" achar "araucária": compara pedaços de duas letras, e a troca
 * de ordem só derruba alguns deles.
 */
export function coeficienteDice(a: string, b: string): number {
  const na = a.replace(/\s+/g, '');
  const nb = b.replace(/\s+/g, '');
  if (na === nb) return na.length === 0 ? 0 : 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const contagem = new Map<string, number>();
  for (let i = 0; i < na.length - 1; i++) {
    const bigrama = na.slice(i, i + 2);
    contagem.set(bigrama, (contagem.get(bigrama) ?? 0) + 1);
  }
  let comuns = 0;
  for (let i = 0; i < nb.length - 1; i++) {
    const bigrama = nb.slice(i, i + 2);
    const quantos = contagem.get(bigrama) ?? 0;
    if (quantos > 0) {
      comuns++;
      contagem.set(bigrama, quantos - 1);
    }
  }
  return (2 * comuns) / (na.length - 1 + (nb.length - 1));
}

/** Todos os nomes por onde a espécie pode ser reconhecida. */
function nomesDa(especie: EspecieParaColagem): string[] {
  const nomes = [especie.nome, ...(especie.nomesPopulares ?? [])];
  if (especie.nomeCientifico) nomes.push(especie.nomeCientifico);
  return nomes;
}

/**
 * A espécie que o texto colado quer dizer.
 *
 * - `exata`: igual a algum nome da espécie, ignorando acento, hífen e plural.
 * - `provavel`: um contém o outro, ou Dice maior ou igual a 0,6. Vem
 *   pré-selecionada na revisão.
 * - `nenhuma`: nada parecido, e a tela não sugere. Chutar aqui faria a pessoa
 *   confirmar sem ler, que é o contrário do que a revisão existe para garantir.
 *
 * O primeiro casamento exato encerra a busca: nome principal certo vence
 * qualquer sinônimo parecido de outra espécie.
 */
export function casaEspecie(nome: string, especies: readonly EspecieParaColagem[]): Casamento {
  const alvo = normalizeNomePopular(nome);
  if (!alvo) return { situacao: 'nenhuma', especieId: null, especie: null, pontos: 0 };
  const alvoSingular = singulariza(alvo);

  let melhor: { especie: EspecieParaColagem; pontos: number; exata: boolean; por: string } | null = null;
  busca: for (const especie of especies) {
    for (const candidato of nomesDa(especie)) {
      const nomeCandidato = normalizeNomePopular(candidato);
      if (!nomeCandidato) continue;
      const candidatoSingular = singulariza(nomeCandidato);
      const exata = nomeCandidato === alvo || candidatoSingular === alvoSingular;

      let pontos: number;
      if (exata) {
        pontos = 1;
      } else {
        const contem =
          nomeCandidato.includes(alvo) ||
          alvo.includes(nomeCandidato) ||
          candidatoSingular.includes(alvoSingular) ||
          alvoSingular.includes(candidatoSingular);
        const dice = Math.max(coeficienteDice(alvo, nomeCandidato), coeficienteDice(alvoSingular, candidatoSingular));
        pontos = contem ? Math.max(dice, PONTOS_CONTEM) : dice;
      }

      if (!melhor || pontos > melhor.pontos) melhor = { especie, pontos, exata, por: candidato };
      if (exata) break busca;
    }
  }

  if (!melhor) return { situacao: 'nenhuma', especieId: null, especie: null, pontos: 0 };
  const situacao: SituacaoCasamento = melhor.exata
    ? 'exata'
    : melhor.pontos >= LIMITE_PROVAVEL
      ? 'provavel'
      : 'nenhuma';
  if (situacao === 'nenhuma') {
    return { situacao, especieId: null, especie: null, pontos: melhor.pontos };
  }
  return {
    situacao,
    especieId: melhor.especie.id,
    especie: melhor.especie.nome,
    pontos: melhor.pontos,
    casouPor: melhor.por === melhor.especie.nome ? null : melhor.por,
  };
}

/** O texto colado inteiro, pronto para a tela de revisão. */
export function montaLinhasColadas(
  texto: string,
  especies: readonly EspecieParaColagem[],
  recipientes: readonly RecipienteParaColagem[] = [],
): LinhaColada[] {
  return parseLinhasPedido(texto).map((linha) => ({
    ...linha,
    casamento: casaEspecie(linha.nome, especies),
    recipienteId: linha.recipiente ? casaRecipiente(linha.recipiente, recipientes) : null,
  }));
}

/**
 * A colagem que veio de planilha, e não de conversa: células separadas por
 * tabulação, uma linha por item.
 *
 * Devolve `null` quando não há tabulação nenhuma, e é assim que a tela decide
 * para onde mandar o texto: sem tabulação, o que a pessoa colou é a lista do
 * WhatsApp, que passa pela revisão de `montaLinhasColadas`; com tabulação, as
 * colunas já vêm separadas e caem direto nas células, a partir da que está em
 * foco.
 */
export function parseColagemTabular(texto: string): string[][] | null {
  if (!texto.includes('\t')) return null;
  const linhas = texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/\s+$/, ''))
    .filter((linha) => linha.trim() !== '')
    .map((linha) => linha.split('\t').map((celula) => celula.trim()));
  return linhas.length > 0 ? linhas : null;
}

export interface RecipienteParaColagem {
  id: string;
  /** Como o recipiente aparece na tela, com o volume junto: "sacos 17x22 · 3 L". */
  nome: string;
}

/**
 * O recipiente que o texto da célula quer dizer. Só aceita igualdade ou um nome
 * contido no outro: aqui não cabe palpite por semelhança, porque "17x22" e
 * "20x26" se parecem demais e trocar um pelo outro é separar a muda errada.
 */
export function casaRecipiente(texto: string, recipientes: readonly RecipienteParaColagem[]): string | null {
  const alvo = normalizeNomePopular(texto);
  if (!alvo) return null;
  const exato = recipientes.find((recipiente) => normalizeNomePopular(recipiente.nome) === alvo);
  if (exato) return exato.id;
  const contido = recipientes.filter((recipiente) => normalizeNomePopular(recipiente.nome).includes(alvo));
  // Mais de um contém o texto: não dá para escolher por conta própria
  return contido.length === 1 ? contido[0].id : null;
}
