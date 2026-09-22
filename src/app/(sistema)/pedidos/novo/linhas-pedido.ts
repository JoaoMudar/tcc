/**
 * As linhas da planilha de itens do pedido novo, e o que a colagem faz com
 * elas. Puro, sem React e sem SQL: é a parte que o teste consegue olhar sem
 * montar tela nenhuma.
 */
import { alturaParaCampo, parseAltura } from '@/lib/pedidos-rotulos';
import {
  type EspecieParaColagem,
  type RecipienteParaColagem,
  casaEspecie,
  casaRecipiente,
} from '@/lib/pedidos-colagem';

export interface Linha {
  chave: number;
  generico: boolean;
  especieId: string;
  recipienteId: string;
  /** Texto, porque o campo é controlado: "1,20" é o que a pessoa vê e digita. */
  altura: string;
  quantidade: string;
}

/** A ordem das colunas na tela, que é também a ordem em que a colagem cai. */
export const COLUNAS = ['especie', 'recipiente', 'altura', 'quantidade'] as const;
export type Coluna = (typeof COLUNAS)[number];

export interface Celula {
  linha: number;
  coluna: number;
}

export function linhaVazia(chave: number): Linha {
  return { chave, generico: false, especieId: '', recipienteId: '', altura: '', quantidade: '' };
}

export function estaVazia(linha: Linha): boolean {
  return !linha.generico && !linha.especieId && !linha.recipienteId && !linha.altura.trim() && !linha.quantidade.trim();
}

export function proximaChave(atuais: readonly Linha[]): number {
  return Math.max(0, ...atuais.map((linha) => linha.chave)) + 1;
}

/** "1.000" e "1 000" da planilha viram "1000"; o que não for número fica como veio. */
function lerQuantidadeCelula(texto: string): string {
  const digitos = texto.replace(/[.,\s]/g, '');
  return /^\d+$/.test(digitos) ? digitos : texto;
}

/** O que a planilha escreveu na altura, guardado como "1,20" quando dá para entender. */
function lerAlturaCelula(texto: string): string {
  const lida = parseAltura(texto);
  return 'error' in lida ? texto : alturaParaCampo(lida.value);
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
      } else if (coluna === 'recipiente') {
        linha.recipienteId = casaRecipiente(texto, recipientes) ?? '';
      } else if (coluna === 'altura') {
        linha.altura = lerAlturaCelula(texto);
      } else {
        linha.quantidade = lerQuantidadeCelula(texto);
      }
    });
  });

  return resultado;
}
