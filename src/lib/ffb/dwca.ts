import { type CategoriaTaxonomica, ROTULO_CATEGORIA, separarAutoria } from './nomes';

/**
 * Leitura do Darwin Core Archive da Lista da Flora e Funga do Brasil (IPT do
 * JBRJ). **A posição das colunas vem do `meta.xml`**, e não do código: o IPT
 * pode reordenar os arquivos entre versões, e o termo Darwin Core é o que fica.
 */

export interface ArquivoDwca {
  rowType: string;
  location: string;
  separador: string;
  delimitador: string;
  ignorarLinhas: number;
  indiceId: number;
  /** Termo curto ("taxonID") → índice da coluna */
  campos: Map<string, number>;
}

export interface MetaDwca {
  core: ArquivoDwca;
  extensoes: ArquivoDwca[];
}

const atributo = (tag: string, nome: string) => tag.match(new RegExp(`\\b${nome}="([^"]*)"`))?.[1];

const desescapa = (s: string) => s.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\r/g, '\r');

/** Último segmento do termo: "http://rs.tdwg.org/dwc/terms/taxonID" → "taxonID". */
const termoCurto = (termo: string) => termo.slice(Math.max(termo.lastIndexOf('/'), termo.lastIndexOf('#')) + 1);

function lerBloco(bloco: string, abertura: string): ArquivoDwca {
  const location = bloco.match(/<location>\s*([^<]+?)\s*<\/location>/)?.[1];
  const rowType = atributo(abertura, 'rowType');
  if (!location || !rowType) throw new Error('meta.xml sem location ou rowType.');
  const id = bloco.match(/<(?:id|coreid)\b[^>]*\bindex="(\d+)"/)?.[1];
  const campos = new Map<string, number>();
  for (const m of bloco.matchAll(/<field\b[^>]*>/g)) {
    const index = atributo(m[0], 'index');
    const term = atributo(m[0], 'term');
    if (index !== undefined && term) campos.set(termoCurto(term), Number(index));
  }
  return {
    rowType: termoCurto(rowType),
    location,
    separador: desescapa(atributo(abertura, 'fieldsTerminatedBy') ?? ','),
    delimitador: desescapa(atributo(abertura, 'fieldsEnclosedBy') ?? ''),
    ignorarLinhas: Number(atributo(abertura, 'ignoreHeaderLines') ?? 0),
    indiceId: Number(id ?? 0),
    campos,
  };
}

export function lerMeta(xml: string): MetaDwca {
  const core = xml.match(/(<core\b[^>]*>)([\s\S]*?)<\/core>/);
  if (!core) throw new Error('meta.xml sem <core>.');
  const extensoes = [...xml.matchAll(/(<extension\b[^>]*>)([\s\S]*?)<\/extension>/g)].map((m) => lerBloco(m[2], m[1]));
  return { core: lerBloco(core[2], core[1]), extensoes };
}

export type Registro = { id: string; get: (termo: string) => string | null };

/** "NA" é como o IPT escreve o vazio em algumas colunas (família de uma ordem). */
const vazio = (v: string | undefined) => v === undefined || v === '' || v === 'NA';

function dividir(linha: string, separador: string, delimitador: string): string[] {
  if (!delimitador || !linha.includes(delimitador)) return linha.split(separador);
  const saida: string[] = [];
  let atual = '';
  let dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === delimitador && dentro && linha[i + 1] === delimitador) {
      atual += c;
      i++;
    } else if (c === delimitador) dentro = !dentro;
    else if (!dentro && linha.startsWith(separador, i)) {
      saida.push(atual);
      atual = '';
      i += separador.length - 1;
    } else atual += c;
  }
  saida.push(atual);
  return saida;
}

export function* lerRegistros(texto: string, arquivo: ArquivoDwca): Generator<Registro> {
  const linhas = texto.replace(/^\uFEFF/, '').split('\n');
  for (let i = arquivo.ignorarLinhas; i < linhas.length; i++) {
    const linha = linhas[i].replace(/\r$/, '');
    if (!linha) continue;
    const valores = dividir(linha, arquivo.separador, arquivo.delimitador);
    yield {
      id: valores[arquivo.indiceId]?.trim() ?? '',
      get: (termo) => {
        const indice = arquivo.campos.get(termo);
        const v = indice === undefined ? undefined : valores[indice]?.trim();
        return vazio(v) ? null : v!.replace(/\s+/g, ' ');
      },
    };
  }
}

// ------------------------------------------------------------
// Do arquivo para as linhas de ref_ffb_*
// ------------------------------------------------------------

export type Situacao = 'NOME_ACEITO' | 'SINONIMO' | 'SEM_SITUACAO';
export type Origem = 'nativa' | 'exotica';

export interface TaxonFfb {
  taxonId: string;
  nomeCientifico: string;
  nomeCanonico: string;
  autoria: string | null;
  categoria: CategoriaTaxonomica;
  situacao: Situacao;
  aceitoTaxonId: string | null;
  familia: string | null;
  genero: string | null;
  origem: Origem | null;
  nativaSc: boolean;
}

export interface DistribuicaoFfb {
  taxonId: string;
  uf: string;
  estabelecimento: Origem | null;
  endemica: boolean | null;
  dominios: string[];
}

export interface NomePopularFfb {
  taxonId: string;
  nome: string;
}

export interface DadosFfb {
  versao: string;
  publicadaEm: string | null;
  taxons: TaxonFfb[];
  distribuicao: DistribuicaoFfb[];
  nomesPopulares: NomePopularFfb[];
  /** Extensões presentes e não usadas: registradas, para quem ler o log saber */
  extensoesIgnoradas: string[];
}

const CATEGORIAS = new Set<string>(['ESPECIE', 'SUB_ESPECIE', 'VARIEDADE', 'FORMA']);

/** Versão e data do `eml.xml`: o `packageId` termina em "/v393.432". */
export function lerVersao(eml: string): { versao: string | null; publicadaEm: string | null } {
  const versao = eml.match(/packageId="[^"]*\/v([\d.]+)"/)?.[1] ?? null;
  const data = eml.match(/<pubDate>\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  return { versao, publicadaEm: data };
}

function estabelecimento(v: string | null): Origem | null {
  const n = v?.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (n === 'nativa') return 'nativa';
  if (n === 'exotica' || n === 'cultivada' || n === 'naturalizada') return 'exotica';
  return null;
}

function lerObservacao(v: string | null): { endemica: boolean | null; dominios: string[] } {
  if (!v) return { endemica: null, dominios: [] };
  try {
    const json = JSON.parse(v) as { endemism?: string; phytogeographicDomain?: unknown };
    const endemismo = json.endemism?.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const dominios = Array.isArray(json.phytogeographicDomain)
      ? json.phytogeographicDomain.filter((d): d is string => typeof d === 'string')
      : [];
    return { endemica: endemismo === 'endemica' ? true : endemismo === 'nao endemica' ? false : null, dominios };
  } catch {
    return { endemica: null, dominios: [] };
  }
}

/**
 * Monta as linhas da referência a partir do arquivo aberto. Fica só Plantae,
 * do nível de espécie para baixo, com os sinônimos: o nome antigo da planilha
 * só se resolve por eles.
 */
export function montarDadosFfb(lerArquivo: (location: string) => string): DadosFfb {
  const meta = lerMeta(lerArquivo('meta.xml'));
  const { versao, publicadaEm } = lerVersao(lerArquivo('eml.xml'));
  if (!versao) throw new Error('eml.xml sem a versão (packageId).');

  for (const termo of ['taxonID', 'scientificName', 'taxonRank', 'taxonomicStatus', 'kingdom']) {
    if (!meta.core.campos.has(termo)) throw new Error(`meta.xml: o núcleo não tem o termo ${termo}.`);
  }

  // Primeira passada: tudo, para a cadeia de sinônimos poder atravessar o filtro
  const brutos = new Map<string, { situacao: Situacao; aceito: string | null }>();
  const taxons = new Map<string, TaxonFfb>();
  for (const r of lerRegistros(lerArquivo(meta.core.location), meta.core)) {
    const taxonId = r.get('taxonID') ?? r.id;
    const status = r.get('taxonomicStatus');
    const situacao: Situacao = status === 'NOME_ACEITO' || status === 'SINONIMO' ? status : 'SEM_SITUACAO';
    // No aceito, o acceptedNameUsageID às vezes aponta para um sinônimo dele: só vale fora do aceito.
    // Nome sem situação também pode apontar (a variante ortográfica "Trema micrantha").
    brutos.set(taxonId, { situacao, aceito: situacao === 'NOME_ACEITO' ? null : r.get('acceptedNameUsageID') });

    const categoria = r.get('taxonRank');
    if (r.get('kingdom') !== 'Plantae' || !categoria || !CATEGORIAS.has(categoria)) continue;
    const nomeCientifico = r.get('scientificName');
    if (!nomeCientifico) continue;

    const genero = r.get('genus');
    const epiteto = r.get('specificEpithet');
    const infra = r.get('infraspecificEpithet');
    const cat = categoria as CategoriaTaxonomica;
    const nomeCanonico =
      genero && epiteto
        ? [genero, epiteto, infra ? ROTULO_CATEGORIA[cat] : '', infra ?? ''].filter(Boolean).join(' ')
        : separarAutoria(nomeCientifico).canonico;

    taxons.set(taxonId, {
      taxonId,
      nomeCientifico,
      nomeCanonico,
      autoria: r.get('scientificNameAuthorship'),
      categoria: cat,
      situacao,
      aceitoTaxonId: null,
      familia: r.get('family'),
      genero,
      origem: null,
      nativaSc: false,
    });
  }

  // O sinônimo aponta para o aceito no fim da cadeia (sinônimo de sinônimo existe)
  for (const t of taxons.values()) {
    if (t.situacao === 'NOME_ACEITO') continue;
    let alvo = brutos.get(t.taxonId)?.aceito ?? null;
    for (let passo = 0; alvo && passo < 10 && brutos.get(alvo) && brutos.get(alvo)!.situacao !== 'NOME_ACEITO'; passo++) {
      alvo = brutos.get(alvo)?.aceito ?? null;
    }
    t.aceitoTaxonId = alvo && alvo !== t.taxonId && taxons.get(alvo)?.situacao === 'NOME_ACEITO' ? alvo : null;
  }

  const extensoesIgnoradas: string[] = [];
  const distribuicao: DistribuicaoFfb[] = [];
  const nomesPopulares: NomePopularFfb[] = [];
  for (const ext of meta.extensoes) {
    if (ext.rowType === 'Distribution') {
      const vistos = new Set<string>();
      for (const r of lerRegistros(lerArquivo(ext.location), ext)) {
        const taxon = taxons.get(r.id);
        if (!taxon) continue;
        const est = estabelecimento(r.get('establishmentMeans'));
        if (est === 'nativa') taxon.origem = 'nativa';
        else if (est === 'exotica' && !taxon.origem) taxon.origem = 'exotica';

        const uf = r.get('locationID')?.match(/^BR-([A-Z]{2})$/)?.[1];
        if (!uf || vistos.has(`${r.id}|${uf}`)) continue;
        vistos.add(`${r.id}|${uf}`);
        if (uf === 'SC' && est === 'nativa') taxon.nativaSc = true;
        distribuicao.push({ taxonId: r.id, uf, estabelecimento: est, ...lerObservacao(r.get('occurrenceRemarks')) });
      }
    } else if (ext.rowType === 'VernacularName') {
      const vistos = new Set<string>();
      for (const r of lerRegistros(lerArquivo(ext.location), ext)) {
        const nome = r.get('vernacularName');
        const lingua = r.get('language');
        if (!nome || !taxons.has(r.id) || (lingua && lingua !== 'PORTUGUES')) continue;
        const chave = `${r.id}|${nome.toLowerCase()}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        nomesPopulares.push({ taxonId: r.id, nome });
      }
    } else extensoesIgnoradas.push(ext.location);
  }

  // O sinônimo não tem distribuição própria: herda a do aceito, para a busca priorizar igual
  for (const t of taxons.values()) {
    const aceito = t.aceitoTaxonId ? taxons.get(t.aceitoTaxonId) : undefined;
    if (aceito && !t.origem) {
      t.origem = aceito.origem;
      t.nativaSc = aceito.nativaSc;
    }
  }

  return { versao, publicadaEm, taxons: [...taxons.values()], distribuicao, nomesPopulares, extensoesIgnoradas };
}
