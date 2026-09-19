import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertArea, insertCanteiro, listAreas } from '../areas';
import { saldoPronto } from '../estoque';
import {
  alterarFase,
  contarLote,
  criarLote,
  dividirLote,
  findLote,
  listLotesAbertos,
  listMovimentos,
  montarOcupacao,
  repicarLote,
  saldoDosMovimentos,
} from '../lotes';
import { registrarMovimento } from '../movimentos';
import { listMortalidadeLotes, listPerdas } from '../perdas';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tl${randomUUID().slice(0, 6)}`;
const canteiro: Record<number, string> = {};
let usuario: string;
let especie: string;
let tubete: string;
let saco: string;

const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);

function novoLote(quantidade: number, numeroCanteiro: number, recipienteId = tubete) {
  return tx((client) =>
    criarLote(client, {
      especieId: especie,
      recipienteId,
      canteiroId: canteiro[numeroCanteiro],
      quantidade,
      dataCriacao: '2026-01-10',
      observacoes: null,
      registradoPor: usuario,
    }),
  );
}

/** RF-35 em todo teste: a soma dos movimentos reproduz o saldo gravado. */
async function fichaConferida(loteId: string) {
  const lote = await findLote(pool, loteId);
  expect(lote).not.toBeNull();
  expect(saldoDosMovimentos(await listMovimentos(pool, loteId))).toBe(lote!.quantidadeAtual);
  return lote!;
}

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Gerência de teste', 'x', 'gerencia', false) RETURNING id`,
    [prefixo],
  );
  usuario = rows[0].id;
  const area = await insertArea(pool, { letra: 'W', nome: null });
  for (const numero of [1, 2, 3, 4, 5]) {
    canteiro[numero] = (await insertCanteiro(pool, { areaId: area, numero, capacidade: null }))!;
  }
  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [`${prefixo} Cedrela`]));
  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
  saco = await insertRecipiente(pool, { nome: `${prefixo} saco 10x18`, volumeLitros: 0.9 });
});

afterAll(async () => {
  const lotes = 'SELECT id FROM lotes WHERE especie_id = $1';
  await pool.query(`DELETE FROM movimentos_lote WHERE lote_id IN (${lotes})`, [especie]);
  await pool.query('UPDATE lotes SET lote_origem_id = NULL WHERE especie_id = $1', [especie]);
  await pool.query('DELETE FROM lotes WHERE especie_id = $1', [especie]);
  await pool.query("DELETE FROM areas WHERE letra = 'W'");
  await pool.query('DELETE FROM especies WHERE id = $1', [especie]);
  await pool.query('DELETE FROM recipientes WHERE id = ANY($1::uuid[])', [[tubete, saco]]);
  await pool.query('DELETE FROM usuarios WHERE id = $1', [usuario]);
  await pool.end();
});

describe('criar lote contra Postgres real', () => {
  it('TA-16: o lote ocupa o canteiro, tem saldo 500, código AAAA-NNNN e o movimento de entrada', async () => {
    const { id, codigo } = await novoLote(500, 1);
    expect(codigo).toMatch(/^2026-\d{4}$/);

    const lote = await fichaConferida(id);
    expect(lote).toMatchObject({ canteiro: 'W-1', quantidadeInicial: 500, quantidadeAtual: 500, fase: 'semeado', dataCriacao: '2026-01-10' });
    // TA-38: a data real do plantio fica vazia ate a etapa do protocolo ser concluida
    expect(lote!.dataPlantio).toBeNull();
    expect(await listMovimentos(pool, id)).toEqual([
      expect.objectContaining({ tipo: 'entrada', quantidade: 500, data: '2026-01-10', registradoPor: 'Gerência de teste' }),
    ]);

    // O canteiro comporta vários lotes (RN-19): o segundo entra depois do primeiro
    const segundo = await novoLote(300, 1);
    expect(Number(segundo.codigo.slice(5))).toBe(Number(codigo.slice(5)) + 1);
    const posicoes = (await listLotesAbertos(pool)).filter((l) => l.canteiroId === canteiro[1]).map((l) => l.posicao);
    expect(posicoes).toEqual([1, 2]);
  });

  it('cinco criações simultâneas não repetem código nem posição', async () => {
    const criados = await Promise.all([1, 2, 3, 4, 5].map(() => novoLote(10, 2)));
    expect(new Set(criados.map((c) => c.codigo)).size).toBe(5);
    const posicoes = (await listLotesAbertos(pool)).filter((l) => l.canteiroId === canteiro[2]).map((l) => l.posicao);
    expect(posicoes).toEqual([1, 2, 3, 4, 5]);
  });

  it('o índice recusa dois lotes abertos na mesma posição do canteiro', async () => {
    const abertos = (await listLotesAbertos(pool)).filter((l) => l.canteiroId === canteiro[2]);
    const erro = await pool
      .query('UPDATE lotes SET posicao = $2 WHERE id = $1', [abertos[1].id, abertos[0].posicao])
      .catch((e: unknown) => e);
    expect(erro).toMatchObject({ code: '23505', constraint: 'lotes_posicao_unica_no_canteiro' });
  });
});

describe('a porta única contra Postgres real', () => {
  it('TA-17: zerado por perda, o lote sai da ocupação, libera o canteiro e continua consultável', async () => {
    const ocupacao = async () =>
      montarOcupacao(await listAreas(pool), await listLotesAbertos(pool))
        .find((a) => a.letra === 'W')!
        .canteiros.find((c) => c.numero === 3)!;
    expect((await ocupacao()).livre).toBe(true);

    const { id } = await novoLote(120, 3);
    expect(await ocupacao()).toMatchObject({ livre: false, mudas: 120 });

    const resultado = await tx((client) =>
      registrarMovimento(client, { loteId: id, tipo: 'perda', quantidade: -120, causa: 'geada', registradoPor: usuario }),
    );
    expect(resultado).toEqual({ saldo: 0, encerrado: true });
    expect((await ocupacao()).livre).toBe(true);

    const lote = await fichaConferida(id);
    expect(lote).toMatchObject({ canteiroId: null, fase: 'encerrado', motivoEncerramento: 'saldo_zero', perdas: 120 });
    expect(lote.encerradoEm).not.toBeNull();
    await expect(
      tx((client) => registrarMovimento(client, { loteId: id, tipo: 'venda', quantidade: -1, registradoPor: usuario })),
    ).rejects.toThrow('está encerrado');
  });

  it('TA-20: perda maior que o saldo é recusada com o saldo, e nada é gravado', async () => {
    const { id } = await novoLote(200, 5);
    await expect(
      tx((client) => registrarMovimento(client, { loteId: id, tipo: 'perda', quantidade: -250, causa: 'praga', registradoPor: usuario })),
    ).rejects.toThrow('tem 200 mudas');
    expect(await fichaConferida(id)).toMatchObject({ quantidadeAtual: 200 });
    expect(await listMovimentos(pool, id)).toHaveLength(1);
  });

  it('TA-18 e TA-19: repicar 300 com 20 mortas deixa 180 na origem e 300 no lote novo, que aponta para ela', async () => {
    const origem = await novoLote(500, 1);
    const novo = await tx((client) =>
      repicarLote(client, {
        origemId: origem.id,
        quantidade: 300,
        perdidas: 20,
        causa: 'manuseio',
        recipienteId: saco,
        canteiroId: canteiro[4],
        observacoes: null,
        registradoPor: usuario,
      }),
    );
    expect(novo).toMatchObject({ saldoOrigem: 180, origemEncerrado: false });

    const fichaOrigem = await fichaConferida(origem.id);
    expect(fichaOrigem).toMatchObject({ quantidadeAtual: 180, perdas: 20, filhos: [{ id: novo.id, codigo: novo.codigo }] });
    expect((await listMovimentos(pool, origem.id)).map((m) => [m.tipo, m.quantidade, m.causa])).toEqual([
      ['entrada', 500, null],
      ['perda', -20, 'manuseio'],
      ['repicagem_saida', -300, null],
    ]);

    const fichaNovo = await fichaConferida(novo.id);
    expect(fichaNovo).toMatchObject({
      quantidadeAtual: 300,
      quantidadeInicial: 300,
      canteiro: 'W-4',
      fase: 'repicado',
      recipienteId: saco,
      origemId: origem.id,
      origemCodigo: origem.codigo,
    });
    expect((await listMovimentos(pool, novo.id)).map((m) => m.tipo)).toEqual(['repicagem_entrada']);
  });

  it('a divisão põe a saída no original e a entrada em cada resultante, e a soma fecha nos três', async () => {
    // Os três ficam no W-3, que é o canteiro que o TA-17 esvazia: os outros
    // testes conferem posição e lotação nos seus, e lote novo ali os quebraria
    const origem = await novoLote(500, 3);
    const { a, b } = await tx((client) =>
      dividirLote(client, {
        origemId: origem.id,
        quantidade: 200,
        canteiroA: canteiro[3],
        canteiroB: canteiro[3],
        observacoes: null,
        registradoPor: usuario,
      }),
    );
    expect([a.quantidade, b.quantidade]).toEqual([300, 200]);

    // O original zera pela saída da divisão, e encerra como dividido, e não como saldo zero
    const ficha = await fichaConferida(origem.id);
    expect(ficha).toMatchObject({ quantidadeAtual: 0, canteiroId: null, fase: 'encerrado', motivoEncerramento: 'dividido' });
    expect((await listMovimentos(pool, origem.id)).map((m) => [m.tipo, m.quantidade])).toEqual([
      ['entrada', 500],
      ['divisao_saida', -500],
    ]);

    // Cada resultante nasce com a sua entrada, o mesmo recipiente e o original como origem
    // UC-24 FA-1: os dois podem ficar no mesmo canteiro, porque a divisão é quase sempre contábil
    for (const [filho, quantidade, canteiro_] of [
      [a, 300, 'W-3'],
      [b, 200, 'W-3'],
    ] as const) {
      const fichaFilho = await fichaConferida(filho.id);
      expect(fichaFilho).toMatchObject({
        quantidadeAtual: quantidade,
        quantidadeInicial: quantidade,
        canteiro: canteiro_,
        recipienteId: ficha.recipienteId,
        origemId: origem.id,
      });
      expect((await listMovimentos(pool, filho.id)).map((m) => m.tipo)).toEqual(['divisao_entrada']);
    }
  });

  it('divisão que não deixa nada de um dos lados é recusada, e o lote continua inteiro', async () => {
    const { id } = await novoLote(100, 3);
    const dividir = (quantidade: number) =>
      tx((client) =>
        dividirLote(client, {
          origemId: id,
          quantidade,
          canteiroA: canteiro[3],
          canteiroB: canteiro[3],
          observacoes: null,
          registradoPor: usuario,
        }),
      );
    await expect(dividir(100)).rejects.toThrow(/menor que o saldo/);
    await expect(dividir(200)).rejects.toThrow(/menor que o saldo/);

    expect(await fichaConferida(id)).toMatchObject({ quantidadeAtual: 100, motivoEncerramento: null });
    expect(await listMovimentos(pool, id)).toHaveLength(1);
  });

  it('repicagem acima do saldo, ou para o mesmo recipiente, é recusada sem gravar nada', async () => {
    const { id } = await novoLote(100, 5);
    const repicar = (quantidade: number, perdidas: number, recipienteId: string) =>
      tx((client) =>
        repicarLote(client, {
          origemId: id,
          quantidade,
          perdidas,
          causa: 'seca',
          recipienteId,
          canteiroId: canteiro[4],
          observacoes: null,
          registradoPor: usuario,
        }),
      );
    await expect(repicar(90, 20, saco)).rejects.toThrow('tem 100 mudas, e a repicagem pede 110');
    await expect(repicar(10, 0, tubete)).rejects.toThrow('A repicagem muda o recipiente');
    expect(await listMovimentos(pool, id)).toHaveLength(1);
  });

  it('TA-65: a contagem passa a valer, e o ajuste aparece no histórico', async () => {
    const { id } = await novoLote(3200, 5);
    const contar = (contado: number) =>
      tx((client) => contarLote(client, { loteId: id, contado, observacoes: null, registradoPor: usuario }));

    expect(await contar(2940)).toMatchObject({ diferenca: -260, saldo: 2940, encerrado: false });
    expect(await contar(2940)).toMatchObject({ diferenca: 0, saldo: 2940 });
    expect(await fichaConferida(id)).toMatchObject({ quantidadeAtual: 2940 });
    expect((await listMovimentos(pool, id)).map((m) => [m.tipo, m.quantidade])).toEqual([
      ['entrada', 3200],
      ['ajuste_contagem', -260],
    ]);
  });

  it('transferência muda o canteiro e vai para o fim da fila, sem mexer no saldo', async () => {
    const { id } = await novoLote(80, 1);
    await tx((client) => registrarMovimento(client, { loteId: id, tipo: 'transferencia', canteiroDestinoId: canteiro[4], registradoPor: usuario }));

    const lote = await fichaConferida(id);
    expect(lote).toMatchObject({ canteiro: 'W-4', quantidadeAtual: 80 });
    expect((await listLotesAbertos(pool)).find((l) => l.id === id)?.posicao).toBe(2);
    expect((await listMovimentos(pool, id)).at(-1)).toMatchObject({
      tipo: 'transferencia',
      quantidade: 0,
      canteiroOrigem: 'W-1',
      canteiroDestino: 'W-4',
    });
  });
});

describe('saldo e perdas contra Postgres real', () => {
  it('TA-64: o saldo pronto por espécie e recipiente coincide com a soma manual dos movimentos', async () => {
    const a = await novoLote(1000, 5);
    const b = await novoLote(400, 5);
    await novoLote(700, 5); // não pronto: fica fora do saldo
    for (const lote of [a, b]) expect(await alterarFase(pool, lote.id, 'pronto')).toBe('ok');
    await tx(async (client) => {
      await registrarMovimento(client, { loteId: a.id, tipo: 'perda', quantidade: -35, causa: 'seca', registradoPor: usuario });
      await registrarMovimento(client, { loteId: a.id, tipo: 'venda', quantidade: -200, registradoPor: usuario });
      await registrarMovimento(client, { loteId: b.id, tipo: 'perda', quantidade: -15, causa: 'praga', registradoPor: usuario });
    });

    const [saldo] = await saldoPronto(pool, { especieId: especie, recipienteId: tubete });
    const { rows } = await pool.query<{ soma: number }>(
      `SELECT SUM(m.quantidade)::int AS soma
         FROM movimentos_lote m JOIN lotes l ON l.id = m.lote_id
        WHERE l.especie_id = $1 AND l.recipiente_id = $2 AND l.fase = 'pronto' AND l.encerrado_em IS NULL`,
      [especie, tubete],
    );
    expect(saldo).toMatchObject({ quantidade: 1150, lotes: 2 });
    expect(saldo.quantidade).toBe(rows[0].soma);
  });

  it('fase de lote encerrado não se altera', async () => {
    const { id } = await novoLote(5, 5);
    await tx((client) => registrarMovimento(client, { loteId: id, tipo: 'perda', quantidade: -5, causa: 'outro', registradoPor: usuario }));
    expect(await alterarFase(pool, id, 'pronto')).toBe('nao_encontrado');
  });

  it('TA-66: o filtro por período devolve só as perdas do intervalo, e a taxa é do lote inteiro', async () => {
    const { id, codigo } = await novoLote(400, 5);
    await tx(async (client) => {
      for (const [data, quantidade] of [
        ['2026-03-01', -40],
        ['2026-05-01', -60],
      ] as const) {
        await registrarMovimento(client, { loteId: id, tipo: 'perda', quantidade, causa: 'geada', data, registradoPor: usuario });
      }
    });

    const filtro = { de: '2026-02-01', ate: '2026-03-31', especieId: especie, causa: 'geada' as const };
    expect((await listPerdas(pool, filtro)).map((p) => [p.codigo, p.data, p.quantidade])).toEqual([[codigo, '2026-03-01', 40]]);
    expect(await listMortalidadeLotes(pool, filtro)).toEqual([expect.objectContaining({ id, perdas: 100, taxa: 0.25 })]);
  });
});
