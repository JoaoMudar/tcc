import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { deleteArea, deleteCanteiro, duplicateCanteiroMessage, insertArea, insertCanteiro, listAreas } from '../areas';
import { duplicateMessage as especieDuplicada, saveEspecie, searchEspecies } from '../especies';
import { findFoto, fotoIdFromUrl } from '../fotos';
import { insertInsumo, listInsumos } from '../insumos';
import {
  type PessoaFields,
  addPapel,
  findPessoa,
  findPessoaPorDocumento,
  findPessoasPorTelefone,
  insertClienteRapido,
  listPessoas,
  savePessoa,
} from '../pessoas';
import { insertRecipiente, listRecipientes } from '../recipientes';
import { findTipoTarefa, insertTipoTarefa, listTiposTarefa, updateTipoTarefa } from '../tipos-tarefa';
import { withTransaction } from '../transaction';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tc${randomUUID().slice(0, 6)}`;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);

afterAll(async () => {
  await pool.query("DELETE FROM areas WHERE letra IN ('Y', 'Z')");
  const { rows } = await pool.query<{ foto_url: string | null }>(
    "SELECT foto_url FROM especies WHERE nome_cientifico LIKE $1 || '%'",
    [prefixo],
  );
  await pool.query("DELETE FROM especies WHERE nome_cientifico LIKE $1 || '%'", [prefixo]);
  const fotos = rows.map((r) => fotoIdFromUrl(r.foto_url)).filter(Boolean);
  await pool.query('DELETE FROM especies_fotos WHERE id = ANY($1::uuid[])', [fotos]);
  await pool.query("DELETE FROM recipientes WHERE nome LIKE $1 || '%'", [prefixo]);
  await pool.query("DELETE FROM insumos WHERE nome LIKE $1 || '%'", [prefixo]);
  await pool.query("DELETE FROM tipos_tarefa WHERE nome LIKE $1 || '%'", [prefixo]);
  await pool.query("DELETE FROM cadastro.pessoas WHERE nome LIKE $1 || '%'", [prefixo]);
  await pool.end();
});

describe('áreas e canteiros contra Postgres real', () => {
  it('TA-09: o canteiro 1 existe na área Y e na Z; o segundo 1 na Y é recusado', async () => {
    const y = await insertArea(pool, { letra: 'Y', nome: null });
    for (const numero of [1, 2, 3]) await insertCanteiro(pool, { areaId: y, numero, capacidade: null });
    const z = await insertArea(pool, { letra: 'Z', nome: 'Sombrite' });
    await insertCanteiro(pool, { areaId: z, numero: 1, capacidade: 500 });

    const error = await insertCanteiro(pool, { areaId: y, numero: 1, capacidade: null }).catch((e: unknown) => e);
    expect(duplicateCanteiroMessage(error, 1, 'Y')).toBe('O canteiro 1 já existe na área Y. Escolha outro número.');

    const lista = await listAreas(pool);
    expect(lista.find((a) => a.letra === 'Y')?.canteiros.map((c) => c.numero)).toEqual([1, 2, 3]);
    expect(lista.find((a) => a.letra === 'Z')?.canteiros).toEqual([expect.objectContaining({ numero: 1, capacidade: 500 })]);
  });

  it('área com canteiro não é excluída; vazia é', async () => {
    const z = (await listAreas(pool)).find((a) => a.letra === 'Z')!;
    expect(await deleteArea(pool, z.id)).toBe('tem_canteiros');
    expect(await deleteCanteiro(pool, z.canteiros[0].id)).toBe('ok');
    expect(await deleteArea(pool, z.id)).toBe('ok');
    expect(await deleteArea(pool, z.id)).toBe('nao_encontrado');
  });

  it('canteiro em área inexistente não é criado', async () => {
    expect(await insertCanteiro(pool, { areaId: randomUUID(), numero: 1, capacidade: null })).toBeNull();
  });
});

describe('espécies contra Postgres real', () => {
  const campos = {
    nomeCientifico: `${prefixo} Cedrela fissilis`,
    nomesPopulares: ['Cedro-rosa', `Acajú ${prefixo}`],
    caracteristicas: ['nativa' as const, 'madeireira' as const],
    observacoes: null,
    ativa: true,
  };
  let especieId: string;

  it('TA-13: busca pelo segundo nome popular (sem acento) e pelo científico acha a mesma espécie, com foto', async () => {
    const result = await withTransaction(pool, (client) =>
      saveEspecie(client, null, campos, { nova: { tipo: 'image/jpeg', conteudo: JPEG }, remover: false }),
    );
    expect(result.resultado).toBe('ok');
    especieId = (result as { id: string }).id;

    const porPopular = await searchEspecies(pool, `acaju ${prefixo}`);
    const porCientifico = await searchEspecies(pool, `${prefixo} CEDRELA`);
    expect(porPopular.map((e) => e.id)).toEqual([especieId]);
    expect(porCientifico.map((e) => e.id)).toEqual([especieId]);
    expect(porPopular[0]).toMatchObject({ nomesPopulares: campos.nomesPopulares, caracteristicas: campos.caracteristicas });

    const foto = await findFoto(pool, fotoIdFromUrl(porPopular[0].fotoUrl)!);
    expect(foto).toEqual({ tipoConteudo: 'image/jpeg', conteudo: JPEG });
  });

  it('trocar a foto apaga a antiga; remover deixa sem foto', async () => {
    const [antes] = await searchEspecies(pool, `${prefixo} cedrela`);
    const antiga = fotoIdFromUrl(antes.fotoUrl)!;

    await withTransaction(pool, (client) =>
      saveEspecie(client, especieId, { ...campos, nomesPopulares: ['Cedro'] }, { nova: { tipo: 'image/png', conteudo: PNG }, remover: false }),
    );
    const [depois] = await searchEspecies(pool, `${prefixo} cedrela`);
    expect(depois.nomesPopulares).toEqual(['Cedro']);
    expect(await findFoto(pool, antiga)).toBeNull();
    const nova = fotoIdFromUrl(depois.fotoUrl)!;
    expect(await findFoto(pool, nova)).toMatchObject({ tipoConteudo: 'image/png' });

    await withTransaction(pool, (client) => saveEspecie(client, especieId, campos, { nova: null, remover: true }));
    const [semFoto] = await searchEspecies(pool, `${prefixo} cedrela`);
    expect(semFoto.fotoUrl).toBeNull();
    expect(await findFoto(pool, nova)).toBeNull();
  });

  it('nome científico repetido é recusado, e a transação não deixa foto órfã', async () => {
    const { rows: antes } = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM especies_fotos');
    const error = await withTransaction(pool, (client) =>
      saveEspecie(client, null, campos, { nova: { tipo: 'image/jpeg', conteudo: JPEG }, remover: false }),
    ).catch((e: unknown) => e);
    expect(especieDuplicada(error)).toBe('Já existe espécie com esse nome científico.');
    const { rows: depois } = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM especies_fotos');
    expect(depois[0].total).toBe(antes[0].total);
  });
});

describe('recipientes, insumos e tipos de tarefa contra Postgres real', () => {
  it('TA-63 (cadastro): recipiente com nome e volume aparece na lista', async () => {
    await insertRecipiente(pool, { nome: `${prefixo} Saco 10x18`, volumeLitros: 0.9 });
    expect((await listRecipientes(pool)).find((r) => r.nome === `${prefixo} Saco 10x18`)).toMatchObject({
      volumeLitros: 0.9,
      ativo: true,
    });
  });

  it('TA-14: insumo aparece com a unidade e a categoria informadas', async () => {
    await insertInsumo(pool, { nome: `${prefixo} Vermiculita`, categoria: 'substrato', unidadeMedida: 'litro' });
    expect((await listInsumos(pool)).find((i) => i.nome === `${prefixo} Vermiculita`)).toMatchObject({
      categoria: 'substrato',
      unidadeMedida: 'litro',
    });
  });

  it('tipo de tarefa guarda as declarações, e a carga inicial está lá', async () => {
    const id = await insertTipoTarefa(pool, {
      nome: `${prefixo} Estaquear`,
      categoria: 'plantio',
      eQuantitativa: true,
      exigeLote: false,
      exigeEspecie: true,
      exigeRecipiente: true,
    });
    expect(
      await updateTipoTarefa(pool, id, {
        nome: `${prefixo} Estaquear`,
        categoria: 'plantio',
        eQuantitativa: false,
        exigeLote: true,
        exigeEspecie: false,
        exigeRecipiente: false,
        ativo: false,
      }),
    ).toBe('ok');
    expect(await findTipoTarefa(pool, id)).toMatchObject({ eQuantitativa: false, exigeLote: true, ativo: false });

    const lista = await listTiposTarefa(pool);
    expect(lista.find((t) => t.nome === 'Repicar')).toMatchObject({ eQuantitativa: true, exigeLote: true });
    expect(lista[0].categoria).toBe('semente');
  });
});

describe('pessoas contra Postgres real', () => {
  const fornecedor: PessoaFields = {
    tipo: 'pj',
    nome: `${prefixo} Viveiro Santa Clara`,
    telefone: '49991882210',
    email: null,
    observacoes: null,
    ativa: true,
    papeis: [{ papel: 'fornecedor', tipoVinculo: null }],
    enderecos: [{ tipo: 'entrega', logradouro: null, cidade: 'Curitibanos', uf: 'SC', cep: null }],
  };
  let pessoaId: string;

  it('TA-15: o fornecedor ganha o papel de cliente e os dados fiscais sem segundo cadastro', async () => {
    const criada = await withTransaction(pool, (client) => savePessoa(client, null, fornecedor, null));
    pessoaId = (criada as { id: string }).id;

    await withTransaction(pool, (client) =>
      savePessoa(
        client,
        pessoaId,
        { ...fornecedor, papeis: [...fornecedor.papeis, { papel: 'cliente', tipoVinculo: null }] },
        {
          documento: '11222333000181',
          enderecoCobranca: { tipo: 'cobranca', logradouro: 'Rua XV, 10', cidade: 'Rio do Sul', uf: 'SC', cep: '89160000' },
        },
      ),
    );

    const { rows } = await pool.query('SELECT id FROM cadastro.pessoas WHERE nome = $1', [fornecedor.nome]);
    expect(rows).toHaveLength(1);
    const ficha = await findPessoa(pool, pessoaId, true);
    expect(ficha?.papeis).toEqual([
      { papel: 'cliente', tipoVinculo: null },
      { papel: 'fornecedor', tipoVinculo: null },
    ]);
    expect(ficha?.documento).toBe('11222333000181');
    expect(ficha?.enderecos.map((e) => e.tipo).sort()).toEqual(['cobranca', 'entrega']);
  });

  it('sem verFiscal, a ficha não traz documento nem endereço de cobrança', async () => {
    const ficha = await findPessoa(pool, pessoaId, false);
    expect(ficha).not.toHaveProperty('documento');
    expect(ficha?.enderecos.map((e) => e.tipo)).toEqual(['entrega']);
  });

  it('salvar sem o bloco fiscal não apaga o documento nem a cobrança', async () => {
    await withTransaction(pool, (client) =>
      savePessoa(client, pessoaId, { ...fornecedor, papeis: [{ papel: 'cliente', tipoVinculo: null }] }, null),
    );
    const ficha = await findPessoa(pool, pessoaId, true);
    expect(ficha?.documento).toBe('11222333000181');
    expect(ficha?.enderecos.map((e) => e.tipo).sort()).toEqual(['cobranca', 'entrega']);
    // O papel retirado fica inativo, e não some da tabela
    const { rows } = await pool.query('SELECT papel, ativo FROM cadastro.pessoas_papeis WHERE pessoa_id = $1 ORDER BY papel', [
      pessoaId,
    ]);
    expect(rows).toEqual([
      { papel: 'cliente', ativo: true },
      { papel: 'fornecedor', ativo: false },
    ]);
  });

  it('TA-67: parte do nome, telefone e documento acham a mesma pessoa', async () => {
    const ids = async (busca: string, verFiscal = true) =>
      (await listPessoas(pool, { busca, verFiscal })).filter((p) => p.nome.startsWith(prefixo)).map((p) => p.id);
    expect(await ids(`${prefixo} viveiro santa`)).toEqual([pessoaId]);
    expect(await ids('(49) 99188-2210')).toEqual([pessoaId]);
    expect(await ids('11.222.333/0001-81')).toEqual([pessoaId]);
  });

  it('sem verFiscal, o documento não acha ninguém e não vem na lista', async () => {
    expect(await listPessoas(pool, { busca: '11.222.333/0001-81', verFiscal: false })).toEqual([]);
    const lista = await listPessoas(pool, { busca: prefixo, verFiscal: false });
    expect(lista.length).toBeGreaterThan(0);
    for (const pessoa of lista) expect(pessoa).not.toHaveProperty('documento');
  });

  it('filtro por papel e identificação de quem já existe', async () => {
    const clientes = await listPessoas(pool, { busca: prefixo, papel: 'cliente', verFiscal: false });
    expect(clientes.map((p) => p.id)).toContain(pessoaId);
    expect(await listPessoas(pool, { busca: prefixo, papel: 'funcionario', verFiscal: false })).toEqual([]);

    expect(await findPessoaPorDocumento(pool, '11222333000181')).toEqual({ id: pessoaId, nome: fornecedor.nome });
    expect(await findPessoaPorDocumento(pool, '11222333000181', pessoaId)).toBeNull();
    expect(await findPessoasPorTelefone(pool, '49991882210')).toEqual([{ id: pessoaId, nome: fornecedor.nome }]);
  });

  it('RF-15 e RF-20: cliente rápido e funcionário sem usuário', async () => {
    const id = await withTransaction(pool, (client) =>
      insertClienteRapido(client, { nome: `${prefixo} Sítio Boa Vista`, telefone: '47996124408' }),
    );
    expect(await findPessoa(pool, id, false)).toMatchObject({ tipo: 'pf', papeis: [{ papel: 'cliente', tipoVinculo: null }] });

    const funcionario = await withTransaction(pool, (client) =>
      savePessoa(
        client,
        null,
        { ...fornecedor, nome: `${prefixo} Valdir`, tipo: 'pf', telefone: null, enderecos: [], papeis: [{ papel: 'funcionario', tipoVinculo: 'diarista' }] },
        null,
      ),
    );
    const ficha = await findPessoa(pool, (funcionario as { id: string }).id, false);
    expect(ficha).toMatchObject({ temAcesso: false, papeis: [{ papel: 'funcionario', tipoVinculo: 'diarista' }] });

    expect(await addPapel(pool, (funcionario as { id: string }).id, 'cliente')).toBe(`${prefixo} Valdir`);
    expect(await addPapel(pool, randomUUID(), 'cliente')).toBeNull();
  });
});
