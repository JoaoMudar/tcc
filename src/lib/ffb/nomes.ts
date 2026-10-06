/**
 * Nome científico: comparação e separação da autoria. Sem `pg`, para rodar
 * igual no script de carga, no servidor e nos testes.
 */

export type CategoriaTaxonomica = 'ESPECIE' | 'SUB_ESPECIE' | 'VARIEDADE' | 'FORMA';

/** Espelho de `normaliza_nome()` da migration 20261008000001: os dois precisam concordar. */
export function normalizaNomeCientifico(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const MARCADORES: Record<string, { rotulo: string; categoria: CategoriaTaxonomica }> = {
  'var.': { rotulo: 'var.', categoria: 'VARIEDADE' },
  var: { rotulo: 'var.', categoria: 'VARIEDADE' },
  'subsp.': { rotulo: 'subsp.', categoria: 'SUB_ESPECIE' },
  subsp: { rotulo: 'subsp.', categoria: 'SUB_ESPECIE' },
  'ssp.': { rotulo: 'subsp.', categoria: 'SUB_ESPECIE' },
  'f.': { rotulo: 'f.', categoria: 'FORMA' },
  forma: { rotulo: 'f.', categoria: 'FORMA' },
};

/** Epíteto é palavra minúscula: "ferrea", "roseo-alba", "×acerifolia". */
const EPITETO = /^×?[a-zà-ÿ][a-zà-ÿ-]*$/;

export interface NomeSeparado {
  canonico: string;
  autoria: string | null;
  categoria: CategoriaTaxonomica;
}

/**
 * "Caesalpinea ferrea Mart. ex Tul. var. leiostachya Benth." vira o canônico
 * "Caesalpinea ferrea var. leiostachya" e a autoria "Benth.". A planilha antiga
 * mistura os dois, e só o canônico se compara com a FFB.
 *
 * Rótulo provisório ("Myrcia sp. 1") volta inteiro, sem autoria.
 */
export function separarAutoria(nome: string): NomeSeparado {
  const tokens = nome.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { canonico: tokens.join(' '), autoria: null, categoria: 'ESPECIE' };

  // Híbrido escrito com o sinal separado: "Platanus × acerifolia"
  if ((tokens[1] === '×' || tokens[1] === 'x') && tokens[2] && EPITETO.test(tokens[2])) {
    tokens.splice(1, 2, `×${tokens[2]}`);
  }
  const [genero, epiteto, ...resto] = tokens;
  if (!EPITETO.test(epiteto) || epiteto === 'sp' || epiteto === 'spp') {
    return { canonico: tokens.join(' '), autoria: null, categoria: 'ESPECIE' };
  }

  for (let i = 0; i < resto.length - 1; i++) {
    const marcador = MARCADORES[resto[i].toLowerCase()];
    if (!marcador || !EPITETO.test(resto[i + 1])) continue;
    // Autônimo ("Schinus terebinthifolia Raddi var. terebinthifolia"): a autoria é a da espécie
    const depois = resto.slice(i + 2);
    const autoria = (depois.length > 0 ? depois : resto.slice(0, i)).join(' ');
    return {
      canonico: `${genero} ${epiteto} ${marcador.rotulo} ${resto[i + 1]}`,
      autoria: autoria || null,
      categoria: marcador.categoria,
    };
  }
  return { canonico: `${genero} ${epiteto}`, autoria: resto.join(' ') || null, categoria: 'ESPECIE' };
}

/** Rótulo da categoria no nome canônico montado a partir dos campos da FFB. */
export const ROTULO_CATEGORIA: Record<CategoriaTaxonomica, string> = {
  ESPECIE: '',
  SUB_ESPECIE: 'subsp.',
  VARIEDADE: 'var.',
  FORMA: 'f.',
};
