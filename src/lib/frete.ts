/**
 * P17: as contas do fechamento do pedido, puras, para a ficha refazê-las
 * enquanto a chefia digita. Quem consulta o mapa e grava é `pedidos-frete.ts`.
 */

export const ORIGENS_FRETE = { agrolandia: 'Agrolândia', itapema: 'Itapema' } as const;
export type OrigemFrete = keyof typeof ORIGENS_FRETE;
export const ORIGEM_PADRAO: OrigemFrete = 'agrolandia';

export function isOrigemFrete(valor: string): valor is OrigemFrete {
  return Object.hasOwn(ORIGENS_FRETE, valor);
}

/**
 * RN-64: o frete sugerido é o combustível da ida e da volta. A distância é a de
 * ida, em km; o resultado, em centavos. A sugestão nunca é gravada sozinha: é
 * a chefia quem decide o frete, e ela digita outro valor quando negociou outro.
 */
export function sugerirFrete(distanciaKm: number, kmPorLitro: number, precoLitro: number): number {
  if (!(distanciaKm > 0) || !(kmPorLitro > 0) || !(precoLitro > 0)) return 0;
  return Math.round(((distanciaKm * 2) / kmPorLitro) * precoLitro * 100);
}

/** O item como o peso o lê: o que vai no caminhão e o peso do recipiente em que vai. */
export interface ItemPesavel {
  /** Quantas vão. Nula é "a definir", e o item fica de fora da conta. */
  quantidade: number | null;
  /** O peso do recipiente cheio em que o item vai. Nulo é "sem peso no cadastro". */
  pesoKg: number | null;
}

/**
 * RN-65: o peso estimado da carga é a soma de quantidade × peso do recipiente
 * cheio. Item sem quantidade ou sem peso não entra, e é contado à parte para a
 * tela dizer que o número está incompleto, em vez de anunciar uma carga mais
 * leve que a verdadeira sem avisar.
 */
export function pesoDoPedido(itens: readonly ItemPesavel[]): { kg: number; semPeso: number } {
  let kg = 0;
  let semPeso = 0;
  for (const item of itens) {
    if (item.quantidade === null || item.pesoKg === null) semPeso++;
    else kg += item.quantidade * item.pesoKg;
  }
  return { kg: Math.round(kg * 10) / 10, semPeso };
}

/** 1240.5 → "≈ 1.241 kg"; acima de 10 t, em toneladas. */
export function formatPesoCarga(kg: number): string {
  if (kg >= 10_000) return `≈ ${(kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`;
  return `≈ ${Math.round(kg).toLocaleString('pt-BR')} kg`;
}

/** Texto do campo de frete, em reais, como o preço: 8400 → "84,00". */
export function freteParaCampo(centavos: number | null): string {
  return centavos === null ? '' : (centavos / 100).toFixed(2).replace('.', ',');
}
