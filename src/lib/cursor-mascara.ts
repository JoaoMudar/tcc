/**
 * Onde fica o cursor depois que a máscara reescreve o campo. A máscara troca
 * parênteses, espaços, traços e vírgulas, e o navegador, ao receber o valor
 * novo, joga o cursor para o fim: corrigir um dígito no meio passaria a
 * digitar no fim. O que não muda é quantos dígitos há antes (ou depois) do
 * cursor, e é por eles que o cursor volta ao lugar.
 */

/** Quantos dígitos há em `texto` antes da posição `pos`. */
export function digitosAntes(texto: string, pos: number): number {
  return texto.slice(0, pos).replace(/\D/g, '').length;
}

/** Quantos dígitos há em `texto` a partir da posição `pos`. */
export function digitosDepois(texto: string, pos: number): number {
  return texto.slice(pos).replace(/\D/g, '').length;
}

/** A posição logo depois do `n`-ésimo dígito; com `n` 0, a do primeiro dígito. */
export function posicaoAposDigitos(texto: string, n: number): number {
  if (n <= 0) {
    const primeiro = texto.search(/\d/);
    return primeiro === -1 ? texto.length : primeiro;
  }
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/\d/.test(texto[i]) && ++vistos === n) return i + 1;
  }
  return texto.length;
}

/** A posição que deixa `n` dígitos à direita do cursor (máscara que enche pela direita). */
export function posicaoAntesDosUltimos(texto: string, n: number): number {
  if (n <= 0) return texto.length;
  let vistos = 0;
  for (let i = texto.length - 1; i >= 0; i--) {
    if (/\d/.test(texto[i]) && ++vistos === n) return i;
  }
  return 0;
}

interface CampoComCursor {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

/** Máscara que enche pela esquerda (telefone): o cursor fica depois dos mesmos dígitos. */
export function cursorPelaEsquerda(campo: CampoComCursor): (texto: string) => number {
  const antes = digitosAntes(campo.value, campo.selectionStart ?? campo.value.length);
  return (texto) => posicaoAposDigitos(texto, antes);
}

/** Máscara que enche pela direita (decimal de três casas): o cursor fica antes dos mesmos dígitos. */
export function cursorPelaDireita(campo: CampoComCursor): (texto: string) => number {
  const depois = digitosDepois(campo.value, campo.selectionEnd ?? campo.value.length);
  return (texto) => posicaoAntesDosUltimos(texto, depois);
}
