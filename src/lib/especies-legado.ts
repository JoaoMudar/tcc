import type { PoolClient } from 'pg';
import type { Linha } from './carga-inicial';
import {
  type ResultadoConciliacao,
  type SituacaoConciliacao,
  type TaxonAceito,
  buscarTaxonAceito,
  lerOrigemDeclarada,
} from './especies-conciliacao';
import { saveEspecie, splitNomes } from './especies';
import { normalizaNomeCientifico, separarAutoria } from './ffb/nomes';

/**
 * A planilha antiga de espécies (`arvores.csv`) entra em duas etapas:
 *
 * 1. `scripts/especies-conciliar.ts` cruza cada linha com a FFB e escreve o
 *    relatório com a coluna `decisao` em branco;
 * 2. a chefia preenche a coluna, e `npm run db:carga -- --decisoes` grava.
 *
 * Nada muda de nome sem uma decisão escrita (RN-67).
 */

export interface EntradaLegada {
  linha: string;
  idLegado: number;
  nomePopular: string;
  nomeCsv: string;
  origemCsv: string;
  /** Campos botânicos da planilha antiga, que por ora vão para as observações */
  extras: Record<string, string>;
}

/** Colunas aceitas: as do `arvores.csv` e as da conciliação semente (mesmo conteúdo, outros nomes). */
export const COLUNAS_LEGADO = ['nome_popular'] as const;

const EXTRAS: Record<string, string> = {
  altura: 'Altura',
  comportamento_folhar: 'Folhagem',
  floracao: 'Floração',
  cor_floracao: 'Cor da flor',
  frutificacao: 'Frutificação',
  fins_plantio: 'Fins de plantio',
  regioes_ocorrencia_cultivo: 'Regiões de ocorrência e cultivo',
};

export function lerEntradasLegadas(linhas: readonly Linha[]): { error: string } | { value: EntradaLegada[] } {
  const saida: EntradaLegada[] = [];
  for (const l of linhas) {
    const id = Number(l.id ?? l.id_legado);
    const nomeCsv = (l.nome_cientifico ?? l.nome_csv ?? '').trim();
    if (!Number.isInteger(id) || id <= 0) return { error: `${l.__linha}: id inválido.` };
    if (!nomeCsv) return { error: `${l.__linha}: falta o nome científico.` };
    const extras: Record<string, string> = {};
    for (const coluna of Object.keys(EXTRAS)) if (l[coluna]?.trim()) extras[coluna] = l[coluna].trim();
    saida.push({
      linha: l.__linha,
      idLegado: id,
      nomePopular: (l.nome_popular ?? '').trim(),
      nomeCsv,
      origemCsv: (l.origem ?? l.origem_csv ?? '').trim(),
      extras,
    });
  }
  return { value: saida };
}

/** Defeitos de dado da planilha. **Listados, nunca corrigidos em silêncio.** */
export function alertasDaPlanilha(entrada: EntradaLegada, slug?: string): string[] {
  const alertas: string[] = [];
  // O espaço sobrando no nome ("Tipuana ") o leitor de CSV já apara; o slug que ele estragou fica
  if (slug && /(^-|-$)/.test(slug)) alertas.push(`Slug malformado: "${slug}"`);
  const altura = entrada.extras.altura?.match(/^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*m/);
  if (altura && altura[1] === altura[2]) alertas.push(`Altura com mínimo igual ao máximo: "${entrada.extras.altura}"`);
  if (/\bat\b/.test(entrada.nomeCsv)) alertas.push('Autoria com "at" (talvez "&" ou "et")');
  return alertas;
}

// ------------------------------------------------------------
// O relatório
// ------------------------------------------------------------

export const COLUNAS_RELATORIO = [
  'id_legado',
  'nome_popular',
  'nome_csv',
  'situacao',
  'taxon_id_ffb',
  'nome_aceito',
  'autoria_ffb',
  'familia',
  'origem_ffb',
  'nativa_sc',
  'origem_csv',
  'semente_situacao',
  'semente_taxon',
  'confere_semente',
  'alertas',
  'decisao',
] as const;

export type LinhaRelatorio = Record<(typeof COLUNAS_RELATORIO)[number], string>;

export interface Semente {
  situacao: string;
  taxonId: string;
}

export function montarLinhaRelatorio(
  entrada: EntradaLegada,
  resultado: ResultadoConciliacao,
  semente: Semente | undefined,
  alertasExtras: readonly string[] = [],
): LinhaRelatorio {
  const a = resultado.aceito;
  const taxon = a?.taxonId ?? '';
  // A semente foi feita pelo espelho do GBIF: comparar a situação e o táxon aceito
  const confere = !semente ? '' : semente.situacao === resultado.situacao && semente.taxonId === taxon ? 'sim' : 'NAO';
  return {
    id_legado: String(entrada.idLegado),
    nome_popular: entrada.nomePopular.trim(),
    nome_csv: entrada.nomeCsv,
    situacao: resultado.situacao,
    taxon_id_ffb: taxon,
    nome_aceito: a?.nomeCanonico ?? '',
    autoria_ffb: a?.autoria ?? '',
    familia: a?.familia ?? '',
    origem_ffb: a?.origem ?? '',
    nativa_sc: a ? (a.nativaSc ? 'sim' : 'nao') : '',
    origem_csv: entrada.origemCsv,
    semente_situacao: semente?.situacao ?? '',
    semente_taxon: semente?.taxonId ?? '',
    confere_semente: confere,
    alertas: [...resultado.alertas, ...alertasExtras].join('; '),
    decisao: '',
  };
}

const celula = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Ponto e vírgula e BOM: é o que o Excel em português abre sem perguntar. */
export function escreverCsv(colunas: readonly string[], linhas: readonly Record<string, string>[], comentarios: readonly string[] = []): string {
  const corpo = [
    ...comentarios.map((c) => `# ${c}`),
    colunas.join(';'),
    ...linhas.map((l) => colunas.map((c) => celula(l[c] ?? '')).join(';')),
  ];
  return `\uFEFF${corpo.join('\r\n')}\r\n`;
}

export const INSTRUCOES_DECISAO = [
  'Preencha a coluna "decisao" de cada linha e salve em CSV (separado por ponto e vírgula).',
  'aceitar = usar o nome da FFB (coluna nome_aceito). Linha OK em branco conta como aceitar.',
  'manter_nome_csv = cadastrar com o nome da planilha antiga, para revisar depois.',
  'usar_taxon:<numero> = usar outro registro da FFB (o número é o taxon_id).',
  'nao_importar = o viveiro não produz: a espécie não entra.',
  'Linha em branco que não seja OK não entra.',
];

// ------------------------------------------------------------
// As decisões
// ------------------------------------------------------------

export type Decisao =
  | { tipo: 'aceitar' }
  | { tipo: 'manter_nome_csv' }
  | { tipo: 'usar_taxon'; taxonId: string }
  | { tipo: 'nao_importar' }
  | { tipo: 'vazia' };

export function lerDecisao(texto: string | undefined): Decisao | { error: string } {
  const t = (texto ?? '').trim().toLowerCase();
  if (!t) return { tipo: 'vazia' };
  if (t === 'aceitar') return { tipo: 'aceitar' };
  if (t === 'manter_nome_csv') return { tipo: 'manter_nome_csv' };
  if (t === 'nao_importar' || t === 'não_importar') return { tipo: 'nao_importar' };
  const taxon = t.match(/^usar_taxon:\s*(\d+)$/);
  if (taxon) return { tipo: 'usar_taxon', taxonId: taxon[1] };
  return { error: `Decisão desconhecida: "${texto}".` };
}

export type Plano =
  | { acao: 'ffb'; taxonId: string }
  | { acao: 'csv'; status: 'pendente' | 'fora_da_ffb' }
  | { acao: 'pular'; motivo: 'nao_importar' | 'sem_decisao' }
  | { acao: 'erro'; mensagem: string };

export function planejar(situacao: string, taxonId: string, decisao: Decisao): Plano {
  switch (decisao.tipo) {
    case 'nao_importar':
      return { acao: 'pular', motivo: 'nao_importar' };
    case 'usar_taxon':
      return { acao: 'ffb', taxonId: decisao.taxonId };
    case 'manter_nome_csv':
      return { acao: 'csv', status: situacao === 'NAO_ENCONTRADO' ? 'fora_da_ffb' : 'pendente' };
    case 'aceitar':
      return taxonId ? { acao: 'ffb', taxonId } : { acao: 'erro', mensagem: 'não há nome da FFB para aceitar nesta linha.' };
    case 'vazia':
      return situacao === 'OK' && taxonId ? { acao: 'ffb', taxonId } : { acao: 'pular', motivo: 'sem_decisao' };
  }
}

/** As observações da espécie que veio da planilha antiga: o que não tem coluna própria. */
export function observacoesLegado(entrada: Pick<EntradaLegada, 'origemCsv' | 'extras'>): string | null {
  const partes = Object.entries(EXTRAS)
    .filter(([coluna]) => entrada.extras[coluna])
    .map(([coluna, rotulo]) => `${rotulo}: ${entrada.extras[coluna]}.`);
  if (entrada.origemCsv) partes.push(`Origem declarada na planilha antiga: ${entrada.origemCsv}.`);
  const texto = partes.join('\n');
  return texto ? texto.slice(0, 1000) : null;
}

// ------------------------------------------------------------
// A gravação
// ------------------------------------------------------------

export interface RelatorioLegado {
  criadas: Record<SituacaoConciliacao | 'MANTIDO_CSV', number>;
  puladas: { nao_importar: number; sem_decisao: number; ja_existia: number };
  erros: string[];
}

/**
 * Grava as espécies decididas, na transação do chamador. Cada uma passa por
 * `saveEspecie`, o mesmo caminho da tela, e depois ganha os campos da FFB.
 */
export async function importarEspeciesLegadas(
  client: PoolClient,
  relatorio: readonly Linha[],
  entradas: ReadonlyMap<number, EntradaLegada>,
  versaoIpt: string | null,
): Promise<RelatorioLegado> {
  const r: RelatorioLegado = {
    criadas: { OK: 0, SINONIMO: 0, GRAFIA: 0, REVISAO_MANUAL: 0, NAO_ENCONTRADO: 0, MANTIDO_CSV: 0 },
    puladas: { nao_importar: 0, sem_decisao: 0, ja_existia: 0 },
    erros: [],
  };

  for (const linha of relatorio) {
    const erro = (msg: string) => r.erros.push(`${linha.__linha}: ${msg}`);
    const decisao = lerDecisao(linha.decisao);
    if ('error' in decisao) {
      erro(decisao.error);
      continue;
    }
    const plano = planejar(linha.situacao, linha.taxon_id_ffb, decisao);
    if (plano.acao === 'erro') {
      erro(plano.mensagem);
      continue;
    }
    if (plano.acao === 'pular') {
      r.puladas[plano.motivo]++;
      continue;
    }

    const idLegado = Number(linha.id_legado);
    const entrada = entradas.get(idLegado);
    const nomeCsv = linha.nome_csv;
    const csv = separarAutoria(nomeCsv);
    let aceito: TaxonAceito | null = null;
    if (plano.acao === 'ffb') {
      aceito = await buscarTaxonAceito(client, plano.taxonId);
      if (!aceito) {
        erro(`o táxon ${plano.taxonId} não está na cópia da FFB, ou não leva a um nome aceito.`);
        continue;
      }
    }
    const nome = aceito?.nomeCanonico ?? csv.canonico;

    // Já existe pelo nome de hoje, pelo táxon ou pelo nome da planilha: a planta cadastrada
    // com o nome antigo não ganha uma gêmea (juntar as duas é a fusão, depois do P20)
    const existe = await client.query(
      `SELECT 1 FROM especies e
        WHERE e.id_legado = $1
           OR (e.substituida_por_id IS NULL
               AND (e.nome_normalizado IN (normaliza_nome($2), normaliza_nome($4)) OR e.taxon_id_ffb = $3
                    OR EXISTS (SELECT 1 FROM especies_sinonimos s WHERE s.especie_id = e.id AND s.nome_normalizado = normaliza_nome($4))))`,
      [idLegado, nome, aceito?.taxonId ?? null, csv.canonico],
    );
    if (existe.rowCount) {
      r.puladas.ja_existia++;
      continue;
    }

    const origem = aceito?.origem ?? lerOrigemDeclarada(linha.origem_csv);
    const salva = await saveEspecie(
      client,
      null,
      {
        nomeCientifico: nome,
        nomesPopulares: splitNomes(linha.nome_popular),
        caracteristicas: origem ? [origem] : [],
        observacoes: observacoesLegado({ origemCsv: linha.origem_csv, extras: entrada?.extras ?? {} }),
        ativa: true,
      },
      { nova: null, remover: false },
    );
    if (salva.resultado !== 'ok') throw new Error('Espécie recém-criada não encontrada.');

    await client.query(
      `UPDATE especies
          SET origem_registro = 'legado_csv', id_legado = $2, autoria = $3, familia = $4, categoria_taxonomica = $5,
              taxon_id_ffb = $6, origem = $7, nativa_sc = $8, status_validacao = $9,
              validado_em = CASE WHEN $9 = 'validado' THEN NOW() END,
              validado_versao_ipt = CASE WHEN $9 = 'validado' THEN $10 END
        WHERE id = $1`,
      [
        salva.id,
        idLegado,
        aceito ? aceito.autoria : csv.autoria,
        aceito?.familia ?? null,
        aceito?.categoria ?? csv.categoria,
        aceito?.taxonId ?? null,
        aceito?.origem ?? null,
        aceito ? aceito.nativaSc : null,
        aceito ? 'validado' : plano.acao === 'csv' ? plano.status : 'pendente',
        versaoIpt,
      ],
    );

    // O nome da planilha, quando é outro, fica como sinônimo: buscar por ele acha a espécie
    if (aceito && normalizaNomeCientifico(csv.canonico) !== normalizaNomeCientifico(aceito.nomeCanonico)) {
      await client.query(
        `INSERT INTO especies_sinonimos (especie_id, nome, autoria, fonte) VALUES ($1, $2, $3, 'legado_csv')
         ON CONFLICT (nome_normalizado) DO NOTHING`,
        [salva.id, csv.canonico, csv.autoria],
      );
    }

    if (plano.acao === 'csv') r.criadas.MANTIDO_CSV++;
    else r.criadas[linha.situacao as SituacaoConciliacao] = (r.criadas[linha.situacao as SituacaoConciliacao] ?? 0) + 1;
  }
  return r;
}
