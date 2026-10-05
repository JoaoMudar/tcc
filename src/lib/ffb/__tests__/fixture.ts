import { deflateRawSync } from 'node:zlib';

/**
 * Um Darwin Core Archive pequeno, no formato do IPT do JBRJ. As colunas do
 * núcleo vêm **em outra ordem** que a do arquivo real: o leitor tem de achar
 * cada uma pelo `meta.xml`.
 */

const NUCLEO = [
  'taxonomicStatus',
  'scientificName',
  'taxonID',
  'acceptedNameUsageID',
  'kingdom',
  'family',
  'genus',
  'specificEpithet',
  'infraspecificEpithet',
  'taxonRank',
  'scientificNameAuthorship',
] as const;

type Taxon = Partial<Record<(typeof NUCLEO)[number], string>> & { taxonID: string };

const T = (t: Taxon) => t;

export const TAXONS: Taxon[] = [
  // O aceito com acceptedNameUsageID apontando para um sinônimo: o IPT faz isso, e não vale
  T({ taxonID: '1', taxonomicStatus: 'NOME_ACEITO', scientificName: 'Schinus terebinthifolia  Raddi', acceptedNameUsageID: '2', kingdom: 'Plantae', family: 'Anacardiaceae', genus: 'Schinus', specificEpithet: 'terebinthifolia', taxonRank: 'ESPECIE', scientificNameAuthorship: 'Raddi' }),
  T({ taxonID: '2', taxonomicStatus: 'SINONIMO', scientificName: 'Schinus terebinthifolius Raddi', acceptedNameUsageID: '1', kingdom: 'Plantae', family: 'Anacardiaceae', genus: 'Schinus', specificEpithet: 'terebinthifolius', taxonRank: 'ESPECIE', scientificNameAuthorship: 'Raddi' }),
  // Sinônimo de sinônimo: leva ao aceito do fim da cadeia
  T({ taxonID: '3', taxonomicStatus: 'SINONIMO', scientificName: 'Schinus antiquus Vell.', acceptedNameUsageID: '2', kingdom: 'Plantae', family: 'Anacardiaceae', genus: 'Schinus', specificEpithet: 'antiquus', taxonRank: 'ESPECIE', scientificNameAuthorship: 'Vell.' }),
  // Sem situação, mas variante ortográfica de um aceito
  T({ taxonID: '4', taxonomicStatus: '', scientificName: 'Trema micrantha (L.) Blume', acceptedNameUsageID: '5', kingdom: 'Plantae', family: 'Cannabaceae', genus: 'Trema', specificEpithet: 'micrantha', taxonRank: 'ESPECIE', scientificNameAuthorship: '(L.) Blume' }),
  T({ taxonID: '5', taxonomicStatus: 'NOME_ACEITO', scientificName: 'Trema micranthum (L.) Blume', kingdom: 'Plantae', family: 'Cannabaceae', genus: 'Trema', specificEpithet: 'micranthum', taxonRank: 'ESPECIE', scientificNameAuthorship: '(L.) Blume' }),
  // Fora: gênero e fungo
  T({ taxonID: '6', taxonomicStatus: 'NOME_ACEITO', scientificName: 'Schinus L.', kingdom: 'Plantae', family: 'NA', genus: 'Schinus', taxonRank: 'GENERO', scientificNameAuthorship: 'L.' }),
  T({ taxonID: '7', taxonomicStatus: 'NOME_ACEITO', scientificName: 'Agaricus campestris L.', kingdom: 'Fungi', family: 'Agaricaceae', genus: 'Agaricus', specificEpithet: 'campestris', taxonRank: 'ESPECIE', scientificNameAuthorship: 'L.' }),
  T({ taxonID: '8', taxonomicStatus: 'NOME_ACEITO', scientificName: 'Morus nigra L.', kingdom: 'Plantae', family: 'Moraceae', genus: 'Morus', specificEpithet: 'nigra', taxonRank: 'ESPECIE', scientificNameAuthorship: 'L.' }),
  // Homônimos: o mesmo nome, autorias diferentes
  T({ taxonID: '9', taxonomicStatus: 'NOME_ACEITO', scientificName: 'Passiflora alata Curtis', kingdom: 'Plantae', family: 'Passifloraceae', genus: 'Passiflora', specificEpithet: 'alata', taxonRank: 'ESPECIE', scientificNameAuthorship: 'Curtis' }),
  T({ taxonID: '10', taxonomicStatus: '', scientificName: 'Passiflora alata Aiton', kingdom: 'Plantae', family: 'Passifloraceae', genus: 'Passiflora', specificEpithet: 'alata', taxonRank: 'ESPECIE', scientificNameAuthorship: 'Aiton' }),
  // Autônimo: a autoria no meio do nome
  T({ taxonID: '11', taxonomicStatus: 'NOME_ACEITO', scientificName: 'Schinus terebinthifolia Raddi var. terebinthifolia', kingdom: 'Plantae', family: 'Anacardiaceae', genus: 'Schinus', specificEpithet: 'terebinthifolia', infraspecificEpithet: 'terebinthifolia', taxonRank: 'VARIEDADE', scientificNameAuthorship: 'Raddi' }),
];

const linha = (valores: readonly string[]) => valores.join('\t');

export function arquivosDwca(): Record<string, string> {
  const campos = NUCLEO.map((termo, i) => `    <field index="${i + 1}" term="http://rs.tdwg.org/dwc/terms/${termo}"/>`);
  const meta = `<archive xmlns="http://rs.tdwg.org/dwc/text/" metadata="eml.xml">
  <core encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy="" ignoreHeaderLines="1" rowType="http://rs.tdwg.org/dwc/terms/Taxon">
    <files><location>taxon.txt</location></files>
    <id index="0" />
${campos.join('\n')}
  </core>
  <extension encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy="" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/Distribution">
    <files><location>distribution.txt</location></files>
    <coreid index="0" />
    <field index="1" term="http://rs.tdwg.org/dwc/terms/locationID"/>
    <field index="2" term="http://rs.tdwg.org/dwc/terms/establishmentMeans"/>
    <field index="3" term="http://rs.tdwg.org/dwc/terms/occurrenceRemarks"/>
  </extension>
  <extension encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy="" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/VernacularName">
    <files><location>vernacularname.txt</location></files>
    <coreid index="0" />
    <field index="1" term="http://rs.tdwg.org/dwc/terms/vernacularName"/>
    <field index="2" term="http://purl.org/dc/terms/language"/>
  </extension>
  <extension encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy="" ignoreHeaderLines="1" rowType="http://rs.gbif.org/terms/1.0/Reference">
    <files><location>reference.txt</location></files>
    <coreid index="0" />
  </extension>
</archive>`;

  const taxon = [
    linha(['id', ...NUCLEO]),
    ...TAXONS.map((t) => linha([t.taxonID, ...NUCLEO.map((c) => t[c] ?? '')])),
  ].join('\n');

  const distribuicao = [
    linha(['id', 'locationID', 'establishmentMeans', 'occurrenceRemarks']),
    linha(['1', 'BR-SC', 'Nativa', '{"endemism":"Não endemica","phytogeographicDomain":["Mata Atlântica","Pampa"]}']),
    linha(['1', 'BR-RS', 'Nativa', '{"endemism":"Não endemica","phytogeographicDomain":["Pampa"]}']),
    linha(['1', 'BR-SC', 'Nativa', '']),
    linha(['5', 'BR-PR', 'Nativa', '{"endemism":"Endemica"}']),
    linha(['8', '', 'Exótica', '']),
    linha(['7', 'BR-SC', 'Nativa', '']),
  ].join('\r\n');

  const vernaculos = [
    linha(['id', 'vernacularName', 'language']),
    linha(['1', 'aroeira', 'PORTUGUES']),
    linha(['1', 'Aroeira', 'PORTUGUES']),
    linha(['1', 'Brazilian pepper', 'INGLES']),
    linha(['5', 'grandiúva', 'PORTUGUES']),
  ].join('\n');

  const eml = `<eml:eml packageId="aacd816d-662c-49d2-ad1a-97e66e2a2908/v393.9" system="http://gbif.org">
  <dataset><pubDate>
      2026-10-01
  </pubDate></dataset></eml:eml>`;

  return { 'meta.xml': meta, 'eml.xml': eml, 'taxon.txt': taxon, 'distribution.txt': distribuicao, 'vernacularname.txt': vernaculos, 'reference.txt': 'id\n' };
}

/** Zip mínimo: o núcleo comprimido com deflate, o resto guardado. O leitor não confere o CRC. */
export function zipar(arquivos: Record<string, string>): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let deslocamento = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const bruto = Buffer.from(conteudo, 'utf8');
    const metodo = nome === 'taxon.txt' ? 8 : 0;
    const dados = metodo === 8 ? deflateRawSync(bruto) : bruto;
    const nomeBuf = Buffer.from(nome, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(bruto.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    locais.push(local, nomeBuf, dados);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(bruto.length, 24);
    central.writeUInt16LE(nomeBuf.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, nomeBuf);
    deslocamento += 30 + nomeBuf.length + dados.length;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}
