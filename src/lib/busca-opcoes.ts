/**
 * Filtro das listas que se digitam (`ComboboxField`). A mesma normalização de
 * `normalizeBusca` está aqui repetida de propósito: `especies.ts` importa `pg`,
 * e o navegador precisa receber estas quatro linhas, não o driver do banco
 * (RNF-11, TA-60).
 */

export interface OpcaoBuscavel {
  value: string;
  label: string;
}

/** "ipe" acha "Ipê": no viveiro ninguém digita acento no celular. */
export function normalizeTexto(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Cada pedaço digitado precisa aparecer no rótulo, em qualquer ordem: "ama ipe"
 * acha "Ipê-amarelo". Busca por pedaço solto é o que serve a quem lembra o nome
 * pela metade, que é o caso de quem cadastra pedido pelo celular.
 */
export function filtraOpcoes<T extends OpcaoBuscavel>(opcoes: readonly T[], busca: string): T[] {
  const termos = normalizeTexto(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return [...opcoes];
  return opcoes.filter((opcao) => {
    const rotulo = normalizeTexto(opcao.label);
    return termos.every((termo) => rotulo.includes(termo));
  });
}
