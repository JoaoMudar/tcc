import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Linha } from '../carga-inicial';
import { conciliarNome } from '../especies-conciliacao';
import { duplicateMessage, saveEspecie } from '../especies';
import { atribuicaoFfb, buscarNomes, conferirNomeNaFfb } from '../especies-ffb';
import { importarEspeciesLegadas } from '../especies-legado';
import { type DadosFfb, montarDadosFfb } from '../ffb/dwca';
import { importarReferenciaFfb } from '../ffb/importar';
import { withTransaction } from '../transaction';
import { arquivosDwca } from '../ffb/__tests__/fixture';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const arquivos = arquivosDwca();
const dados = montarDadosFfb((l) => arquivos[l]);
const criadas: string[] = [];

async function cria(nome: string, populares: string[] = []): Promise<string> {
  const salva = await withTransaction(pool, (c) =>
    saveEspecie(c, null, { nomeCientifico: nome, nomesPopulares: populares, caracteristicas: [], observacoes: null, ativa: true }, { nova: null, remover: false }),
  );
  if (salva.resultado !== 'ok') throw new Error('não criou');
  criadas.push(salva.id);
  return salva.id;
}

const ficha = async (id: string) =>
  (
    await pool.query(
      `SELECT nome_cientifico, status_validacao, taxon_id_ffb, familia, autoria, origem, nativa_sc, origem_registro,
              validado_versao_ipt, id_legado, observacoes
         FROM especies WHERE id = $1`,
      [id],
    )
  ).rows[0];

beforeAll(async () => {
  await withTransaction(pool, (c) => importarReferenciaFfb(c, dados));
});

afterAll(async () => {
  await pool.query('DELETE FROM especies WHERE id = ANY($1::uuid[]) OR id_legado IS NOT NULL', [criadas]);
  await pool.query('TRUNCATE ref_ffb_nome_popular, ref_ffb_distribuicao, ref_ffb_taxon, ref_ffb_importacao');
  await pool.end();
});

describe('cópia local da FFB (RF-69)', () => {
  it('a importação grava táxons, distribuição, nomes e a versão', async () => {
    const { rows } = await pool.query(
      `SELECT (SELECT count(*)::int FROM ref_ffb_taxon) AS taxons,
              (SELECT count(*)::int FROM ref_ffb_distribuicao) AS dist,
              (SELECT count(*)::int FROM ref_ffb_nome_popular) AS nomes,
              (SELECT nome_normalizado FROM ref_ffb_taxon WHERE taxon_id = '1') AS normalizado,
              (SELECT dominios FROM ref_ffb_distribuicao WHERE taxon_id = '1' AND uf = 'SC') AS dominios`,
    );
    expect(rows[0]).toEqual({ taxons: 9, dist: 3, nomes: 2, normalizado: 'schinus terebinthifolia', dominios: ['Mata Atlântica', 'Pampa'] });
    expect(await atribuicaoFfb(pool)).toMatch(/Flora e Funga do Brasil, Jardim Botânico do Rio de Janeiro \(versão 393\.9\), licença CC-BY 4\.0/);
  });

  it('importação que falha no meio deixa a versão anterior intacta', async () => {
    const quebrado: DadosFfb = { ...dados, distribuicao: [...dados.distribuicao, { taxonId: 'nao-existe', uf: 'SC', estabelecimento: null, endemica: null, dominios: [] }] };
    await expect(withTransaction(pool, (c) => importarReferenciaFfb(c, quebrado))).rejects.toThrow();
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM ref_ffb_taxon');
    expect(rows[0].n).toBe(9);
  });

  it('ensaio (ROLLBACK) não deixa linha nenhuma da versão nova', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await importarReferenciaFfb(client, { ...dados, versao: '999.0', taxons: dados.taxons.slice(0, 2), distribuicao: [], nomesPopulares: [] });
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    const { rows } = await pool.query("SELECT count(*)::int AS n, (SELECT count(*)::int FROM ref_ffb_importacao WHERE versao_ipt = '999.0') AS v FROM ref_ffb_taxon");
    expect(rows[0]).toEqual({ n: 9, v: 0 });
  });

  it('conciliação contra a cópia: sinônimo, variante e homônimo', async () => {
    expect((await conciliarNome(pool, 'Schinus antiquus Vell.')).aceito?.taxonId).toBe('1');
    expect((await conciliarNome(pool, 'Trema micrantha (L.) Blume'))).toMatchObject({ situacao: 'SINONIMO', aceito: { taxonId: '5' } });
    expect((await conciliarNome(pool, 'Passiflora alata Curtis'))).toMatchObject({ situacao: 'OK', aceito: { taxonId: '9' } });
    expect((await conciliarNome(pool, 'Schinus terebintifolia Raddi'))).toMatchObject({ situacao: 'GRAFIA', aceito: { taxonId: '1' } });
  });
});

describe('o nome da espécie e a FFB (RF-68, RN-68)', () => {
  it('nome idêntico a um aceito fica validado sem a pessoa ver nada', async () => {
    const id = await cria('Morus nigra', ['Amoreira']);
    await withTransaction(pool, (c) => conferirNomeNaFfb(c, id));
    expect(await ficha(id)).toMatchObject({
      status_validacao: 'validado',
      taxon_id_ffb: '8',
      familia: 'Moraceae',
      autoria: 'L.',
      origem: 'exotica',
      nativa_sc: false,
      origem_registro: 'manual',
      validado_versao_ipt: '393.9',
    });
  });

  it('nome antigo digitado à mão não bloqueia: entra pendente', async () => {
    const id = await cria('Trema micrantha');
    expect(await withTransaction(pool, (c) => conferirNomeNaFfb(c, id))).toEqual({ status: 'pendente', familia: null });
    expect((await ficha(id)).status_validacao).toBe('pendente');
  });

  it('escolher o nome antigo na busca cadastra o de hoje e guarda o antigo como sinônimo', async () => {
    const id = await cria('Schinus terebinthifolia', ['Aroeira']);
    await withTransaction(pool, (c) => conferirNomeNaFfb(c, id, { taxonId: '1', sinonimoTaxonId: '2' }));
    expect(await ficha(id)).toMatchObject({ status_validacao: 'validado', taxon_id_ffb: '1', origem_registro: 'ffb', nativa_sc: true });
    const sin = await pool.query('SELECT nome, fonte, taxon_id_ffb FROM especies_sinonimos WHERE especie_id = $1', [id]);
    expect(sin.rows).toEqual([{ nome: 'Schinus terebinthifolius', fonte: 'ffb', taxon_id_ffb: '2' }]);
  });

  it('a busca acha pelo sinônimo a espécie que já existe, e tira da lista da FFB o que o viveiro tem', async () => {
    const r = await buscarNomes(pool, 'schinus antiquus');
    expect(r.doViveiro).toEqual([expect.objectContaining({ nome: 'Aroeira', nomeCientifico: 'Schinus terebinthifolia', achadaPor: 'Schinus antiquus' })]);
    expect(r.daFlora.map((f) => f.taxonId)).not.toContain('1');

    const aroeira = await buscarNomes(pool, 'aroeira');
    // "Amoreira" vem depois, pela semelhança: é a tolerância ao erro de digitação
    expect(aroeira.doViveiro.map((v) => v.nome)).toEqual(['Aroeira', 'Amoreira']);
    expect(aroeira.daFlora).toEqual([]);

    const grandiuva = await buscarNomes(pool, 'grandiuva');
    expect(grandiuva.daFlora).toEqual([
      { taxonId: '5', nomeCientifico: 'Trema micranthum', familia: 'Cannabaceae', nomePopular: 'grandiúva', nativaSc: false, aceito: null },
    ]);
    expect(await buscarNomes(pool, 'ar')).toEqual({ doViveiro: [], daFlora: [] });
  });

  it('o mesmo nome não é de uma espécie e sinônimo de outra', async () => {
    const erro = await cria('Schinus  TEREBINTHIFOLIUS').catch((e: unknown) => e);
    expect(duplicateMessage(erro)).toBe('Esse nome científico é um nome antigo de outra espécie já cadastrada.');
    const repetido = await cria('schinus terebinthifolia').catch((e: unknown) => e);
    expect(duplicateMessage(repetido)).toBe('Já existe espécie com esse nome científico.');
  });

  it('renomear não troca o id; renomear para fora da FFB devolve à revisão', async () => {
    const id = await cria('Passiflora alata');
    await withTransaction(pool, (c) => conferirNomeNaFfb(c, id));
    expect((await ficha(id)).status_validacao).toBe('validado');
    await withTransaction(pool, async (c) => {
      await saveEspecie(c, id, { nomeCientifico: 'Passiflora edulis', nomesPopulares: [], caracteristicas: [], observacoes: null, ativa: true }, { nova: null, remover: false });
      await conferirNomeNaFfb(c, id);
    });
    expect(await ficha(id)).toMatchObject({ nome_cientifico: 'Passiflora edulis', status_validacao: 'pendente', taxon_id_ffb: null });
  });
});

describe('planilha antiga com as decisões (RN-67)', () => {
  const linha = (l: Partial<Linha>): Linha =>
    ({ __linha: `relatorio.csv linha ${l.id_legado}`, nome_popular: '', origem_csv: '', taxon_id_ffb: '', decisao: '', ...l }) as Linha;

  it('grava só o decidido, com o nome da FFB, e o nome da planilha vira sinônimo', async () => {
    const relatorio = [
      linha({ id_legado: '100', nome_popular: 'Maracujá-doce', nome_csv: 'Passiflora alatta Curtis', situacao: 'GRAFIA', taxon_id_ffb: '9', origem_csv: 'Nativa', decisao: 'aceitar' }),
      // O viveiro já tem a planta, cadastrada à mão com o nome antigo: não ganha gêmea
      linha({ id_legado: '66', nome_popular: 'Grandiúva', nome_csv: 'Trema micrantha (L.) Blum.', situacao: 'SINONIMO', taxon_id_ffb: '5', decisao: 'aceitar' }),
      linha({ id_legado: '67', nome_popular: 'Sem decisão', nome_csv: 'Schinus antiquus', situacao: 'SINONIMO', taxon_id_ffb: '1' }),
      linha({ id_legado: '40', nome_popular: 'Cereja-australiana', nome_csv: 'Eugenia reinwardtiana (Blume) DC.', situacao: 'NAO_ENCONTRADO', origem_csv: 'Exótica', decisao: 'manter_nome_csv' }),
      linha({ id_legado: '125', nome_popular: 'Plátano', nome_csv: 'Platanus acerifolia', situacao: 'REVISAO_MANUAL', decisao: 'nao_importar' }),
    ];
    const extras = new Map([[100, { linha: '', idLegado: 100, nomePopular: '', nomeCsv: '', origemCsv: 'Nativa', extras: { altura: '5-10m' } }]]);

    const r = await withTransaction(pool, (c) => importarEspeciesLegadas(c, relatorio, extras, '393.9'));
    expect(r.erros).toEqual([]);
    expect(r.criadas).toMatchObject({ GRAFIA: 1, MANTIDO_CSV: 1, SINONIMO: 0 });
    expect(r.puladas).toEqual({ nao_importar: 1, sem_decisao: 1, ja_existia: 1 });

    const { rows } = await pool.query('SELECT id FROM especies WHERE id_legado = 100');
    expect(await ficha(rows[0].id)).toMatchObject({
      nome_cientifico: 'Passiflora alata',
      autoria: 'Curtis',
      status_validacao: 'validado',
      taxon_id_ffb: '9',
      origem_registro: 'legado_csv',
      observacoes: 'Altura: 5-10m.\nOrigem declarada na planilha antiga: Nativa.',
    });
    const sin = await pool.query('SELECT nome, autoria, fonte FROM especies_sinonimos WHERE especie_id = $1', [rows[0].id]);
    expect(sin.rows).toEqual([{ nome: 'Passiflora alatta', autoria: 'Curtis', fonte: 'legado_csv' }]);

    const cereja = await pool.query("SELECT status_validacao, autoria, taxon_id_ffb FROM especies WHERE id_legado = 40");
    expect(cereja.rows[0]).toEqual({ status_validacao: 'fora_da_ffb', autoria: '(Blume) DC.', taxon_id_ffb: null });

    // Rodar de novo não duplica
    const outra = await withTransaction(pool, (c) => importarEspeciesLegadas(c, relatorio, extras, '393.9'));
    expect(outra.puladas.ja_existia).toBe(3);
  });

  it('decisão inválida ou táxon que não leva a aceito vira erro de linha', async () => {
    const r = await withTransaction(pool, (c) =>
      importarEspeciesLegadas(
        c,
        [
          linha({ id_legado: '1', nome_csv: 'X y', situacao: 'OK', decisao: 'talvez' }),
          linha({ id_legado: '2', nome_csv: 'Passiflora alata Aiton', situacao: 'REVISAO_MANUAL', decisao: 'usar_taxon:10' }),
        ],
        new Map(),
        null,
      ),
    );
    expect(r.erros).toEqual([
      'relatorio.csv linha 1: Decisão desconhecida: "talvez".',
      'relatorio.csv linha 2: o táxon 10 não está na cópia da FFB, ou não leva a um nome aceito.',
    ]);
  });
});
