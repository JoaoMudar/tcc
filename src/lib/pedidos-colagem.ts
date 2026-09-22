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

export interface LinhaLida {
  /** A linha como o cliente escreveu, para a revisão mostrar de onde veio. */
  bruta: string;
  nome: string;
  quantidade: number | null;
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
}

/** Abaixo disto o palpite não ajuda: mostrar espécie errada é pior que não mostrar nenhuma. */
const LIMITE_PROVAVEL = 0.6;

/** Um nome contido no outro é palpite forte, ainda que os bigramas não digam isso. */
const PONTOS_CONTEM = 0.85;

/** Marcadores de lista: "- ", "* ", "• ", "· ", travessões, "1) ", "1. ". */
const MARCADOR_LISTA = /^\s*(?:[-*•·–—]|\d{1,2}[.)])\s+/;

/** Unidades grudadas na quantidade, que são ignoradas: "500un", "500 mudas", "20 pçs". */
const SUFIXO_UNIDADE = '(?:un|und|unds?|unid(?:ades?)?|mudas?|p(?:c|ç)s?|p(?:c|ç)as?)?';

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
 */
function separaNomeEQuantidade(linha: string): { nome: string; quantidade: number | null } {
  const noFim = linha.match(new RegExp(`^(.+?)[\\s\\-:–—xX×]*\\s*([\\d.,]+)\\s*${SUFIXO_UNIDADE}\\s*$`, 'i'));
  if (noFim) {
    const quantidade = lerQuantidadeColada(noFim[2]);
    const nome = limpaNome(noFim[1]);
    if (quantidade !== null && nome) return { nome, quantidade };
  }
  const noInicio = linha.match(/^([\d.,]+)\s*[xX×]?\s*[-:.]?\s*(.+)$/);
  if (noInicio) {
    const quantidade = lerQuantidadeColada(noInicio[1]);
    const nome = limpaNome(noInicio[2]);
    if (quantidade !== null && nome) return { nome, quantidade };
  }
  return { nome: limpaNome(linha), quantidade: null };
}

/** Uma entrada por linha útil. Vazias e linhas sem letra nenhuma são descartadas. */
export function parseLinhasPedido(texto: string): LinhaLida[] {
  const lidas: LinhaLida[] = [];
  for (const original of texto.split(/\r?\n/)) {
    const bruta = original.trim();
    if (!bruta) continue;
    if (!/[a-zA-ZÀ-ɏ]/.test(bruta)) continue;
    const { nome, quantidade } = separaNomeEQuantidade(bruta.replace(MARCADOR_LISTA, ''));
    if (!nome) continue;
    lidas.push({ bruta, nome, quantidade });
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
export function montaLinhasColadas(texto: string, especies: readonly EspecieParaColagem[]): LinhaColada[] {
  return parseLinhasPedido(texto).map((linha) => ({ ...linha, casamento: casaEspecie(linha.nome, especies) }));
}
