import { describe, expect, it } from 'vitest';
import { lerMeta, lerRegistros, lerVersao, montarDadosFfb } from '../dwca';
import { lerZip } from '../zip';
import { arquivosDwca, zipar } from './fixture';

const arquivos = arquivosDwca();
const ler = (location: string) => {
  const conteudo = arquivos[location];
  if (conteudo === undefined) throw new Error(location);
  return conteudo;
};

describe('meta.xml (RF-69)', () => {
  it('a coluna é achada pelo termo, e não pela posição', () => {
    const meta = lerMeta(arquivos['meta.xml']);
    expect(meta.core.location).toBe('taxon.txt');
    expect(meta.core.separador).toBe('\t');
    expect(meta.core.ignorarLinhas).toBe(1);
    expect(meta.core.campos.get('taxonID')).toBe(3);
    expect(meta.core.campos.get('taxonomicStatus')).toBe(1);
    expect(meta.extensoes.map((e) => e.rowType)).toEqual(['Distribution', 'VernacularName', 'Reference']);
  });

  it('"NA" e vazio são ausência, e o espaço duplo some', () => {
    const meta = lerMeta(arquivos['meta.xml']);
    const registros = [...lerRegistros(arquivos['taxon.txt'], meta.core)];
    expect(registros[0].get('scientificName')).toBe('Schinus terebinthifolia Raddi');
    expect(registros.find((r) => r.id === '6')!.get('family')).toBeNull();
    expect(registros.find((r) => r.id === '4')!.get('taxonomicStatus')).toBeNull();
  });

  it('meta.xml sem núcleo é recusado', () => {
    expect(() => lerMeta('<archive></archive>')).toThrow(/core/);
  });

  it('a versão vem do packageId do eml.xml', () => {
    expect(lerVersao(arquivos['eml.xml'])).toEqual({ versao: '393.9', publicadaEm: '2026-10-01' });
    expect(lerVersao('<eml/>')).toEqual({ versao: null, publicadaEm: null });
  });
});

describe('montarDadosFfb', () => {
  const dados = montarDadosFfb(ler);
  const taxon = (id: string) => dados.taxons.find((t) => t.taxonId === id);

  it('fica só Plantae, do nível de espécie para baixo', () => {
    expect(dados.taxons.map((t) => t.taxonId).sort()).toEqual(['1', '10', '11', '2', '3', '4', '5', '8', '9']);
  });

  it('o aceito não aponta para ninguém, mesmo que o arquivo diga', () => {
    expect(taxon('1')).toMatchObject({ situacao: 'NOME_ACEITO', aceitoTaxonId: null, nomeCanonico: 'Schinus terebinthifolia' });
  });

  it('o sinônimo leva ao aceito do fim da cadeia', () => {
    expect(taxon('2')?.aceitoTaxonId).toBe('1');
    expect(taxon('3')?.aceitoTaxonId).toBe('1');
  });

  it('o nome sem situação que aponta para um aceito também leva a ele', () => {
    expect(taxon('4')).toMatchObject({ situacao: 'SEM_SITUACAO', aceitoTaxonId: '5' });
    expect(taxon('10')).toMatchObject({ situacao: 'SEM_SITUACAO', aceitoTaxonId: null });
  });

  it('o canônico do autônimo leva o marcador e não a autoria', () => {
    expect(taxon('11')).toMatchObject({ nomeCanonico: 'Schinus terebinthifolia var. terebinthifolia', categoria: 'VARIEDADE' });
  });

  it('a origem e a nativa de SC saem da distribuição; o sinônimo herda do aceito', () => {
    expect(taxon('1')).toMatchObject({ origem: 'nativa', nativaSc: true });
    expect(taxon('5')).toMatchObject({ origem: 'nativa', nativaSc: false });
    expect(taxon('8')).toMatchObject({ origem: 'exotica', nativaSc: false });
    expect(taxon('2')).toMatchObject({ origem: 'nativa', nativaSc: true });
    expect(taxon('9')).toMatchObject({ origem: null, nativaSc: false });
  });

  it('a distribuição por UF não repete, e ignora a linha sem UF e o táxon de fora', () => {
    expect(dados.distribuicao).toEqual([
      { taxonId: '1', uf: 'SC', estabelecimento: 'nativa', endemica: false, dominios: ['Mata Atlântica', 'Pampa'] },
      { taxonId: '1', uf: 'RS', estabelecimento: 'nativa', endemica: false, dominios: ['Pampa'] },
      { taxonId: '5', uf: 'PR', estabelecimento: 'nativa', endemica: true, dominios: [] },
    ]);
  });

  it('nome popular: só em português e sem repetir', () => {
    expect(dados.nomesPopulares).toEqual([
      { taxonId: '1', nome: 'aroeira' },
      { taxonId: '5', nome: 'grandiúva' },
    ]);
  });

  it('registra a versão e as extensões presentes e não usadas', () => {
    expect(dados.versao).toBe('393.9');
    expect(dados.extensoesIgnoradas).toEqual(['reference.txt']);
  });

  it('sem versão no eml.xml, para', () => {
    expect(() => montarDadosFfb((l) => (l === 'eml.xml' ? '<eml/>' : ler(l)))).toThrow(/versão/);
  });
});

describe('lerZip', () => {
  it('abre entradas guardadas e comprimidas', () => {
    const zip = lerZip(zipar(arquivos));
    expect([...zip.keys()]).toContain('taxon.txt');
    expect(zip.get('taxon.txt')!().toString('utf8')).toBe(arquivos['taxon.txt']);
    expect(zip.get('meta.xml')!().toString('utf8')).toBe(arquivos['meta.xml']);
  });

  it('o arquivo do fixture inteiro passa pelo mesmo caminho do script', () => {
    const zip = lerZip(zipar(arquivos));
    const dados = montarDadosFfb((l) => zip.get(l)!().toString('utf8'));
    expect(dados.taxons).toHaveLength(9);
  });

  it('o que não é zip é recusado', () => {
    expect(() => lerZip(Buffer.from('<html>403 Forbidden</html>'))).toThrow(/não é um zip/);
  });
});
