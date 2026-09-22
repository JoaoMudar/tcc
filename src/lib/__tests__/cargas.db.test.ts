import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  concluirCarga,
  criarCargaUnica,
  criarCargas,
  listCargas,
  marcarItemSeparado,
  pedidosDoPeriodo,
} from '../cargas';
import { hojeNoViveiro, somaDias } from '../datas';
import {
  concluirVerificacao,
  confirmarPedido,
  criarPedido,
  definirComposicaoGenerico,
  findPedido,
  iniciarVerificacao,
  listItens,
  marcarDisponibilidade,
} from '../pedidos';
import { SITUACOES_CARGA } from '../pedidos-rotulos';
import { insertClienteRapido } from '../pessoas';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

/**
 * A contagem para carregar (T8.13) contra Postgres real. O que se confere aqui é
 * o que o teste puro não alcança: que a carga só fecha com tudo separado, que o
 * pedido só fica pronto na última, e que o pai genérico não vai no caminhão.
 */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tc${randomUUID().slice(0, 6)}`;
const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);

const chefia = () => ({ perfil: 'chefia' as const, usuarioId: usuario });
const gerencia = () => ({ perfil: 'gerencia' as const, usuarioId: usuario });

let usuario: string;
let cliente: string;
let especie: string;
let outraEspecie: string;
let tubete: string;
let saco: string;

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Chefia de carga', 'x', 'chefia', false) RETURNING id`,
    [prefixo],
  );
  usuario = rows[0].id;
  cliente = await tx((client) => insertClienteRapido(client, { nome: `${prefixo} Cliente`, telefone: null }));

  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [
    `${prefixo} Araucaria`,
  ]));
  ({
    rows: [{ id: outraEspecie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [
    `${prefixo} Cedrela`,
  ]));

  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
  saco = await insertRecipiente(pool, { nome: `${prefixo} saco`, volumeLitros: 3 });
});

afterAll(async () => {
  await pool.end();
});

/** Um pedido com dois itens, levado até `aprovado` pelo caminho normal. */
async function pedidoAprovado(dataEntrega: string | null = null) {
  const { id } = await tx((client) =>
    criarPedido(client, {
      clienteId: cliente,
      canal: 'atacado',
      dataEntrega,
      observacoes: null,
      criadoPor: usuario,
      itens: [
        { especieId: especie, recipienteId: tubete, quantidade: 500, precoCentavos: 200 },
        { especieId: outraEspecie, recipienteId: saco, quantidade: 200, precoCentavos: 1200 },
      ],
    }),
  );
  await tx((c) => iniciarVerificacao(c, id, gerencia()));
  for (const item of await listItens(pool, id)) {
    await tx((c) => marcarDisponibilidade(c, id, item.id, 'disponivel', gerencia()));
  }
  await tx((c) => concluirVerificacao(c, id, gerencia()));
  await tx((c) => confirmarPedido(c, id, chefia()));
  return id;
}

/** Genérico de propósito: tipar o parâmetro como `{ especie }` apagaria o resto do item. */
function porEspecie<T extends { especie: string }>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => a.especie.localeCompare(b.especie));
}

describe('a lista fechada da carga', () => {
  it('é a mesma no banco e no TypeScript', async () => {
    const { rows } = await pool.query<{ def: string }>(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'pedidos_cargas_situacao_valida'",
    );
    const noBanco = [...rows[0].def.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(noBanco).toEqual(Object.keys(SITUACOES_CARGA).sort());
  });
});

describe('organizar em cargas (T8.13)', () => {
  it('cabe em uma viagem: uma carga com tudo, e o pedido entra em separação', async () => {
    const id = await pedidoAprovado();
    await tx((c) => criarCargaUnica(c, id, gerencia()));

    const cargas = await listCargas(pool, id);
    expect(cargas).toHaveLength(1);
    expect(cargas[0]).toMatchObject({ numero: 1, situacao: 'pendente' });
    expect(cargas[0].itens.map((i) => i.quantidade).sort((a, b) => a - b)).toEqual([200, 500]);
    expect(cargas[0].itens.every((i) => i.separado === false)).toBe(true);
    expect((await findPedido(pool, id))!.situacao).toBe('separando');
  });

  it('pedido que não está aprovado não organiza carga', async () => {
    const { id } = await tx((client) =>
      criarPedido(client, {
        clienteId: cliente,
        canal: 'atacado',
        dataEntrega: null,
        observacoes: null,
        criadoPor: usuario,
        itens: [{ especieId: especie, recipienteId: tubete, quantidade: 10, precoCentavos: 100 }],
      }),
    );
    await expect(tx((c) => criarCargaUnica(c, id, gerencia()))).rejects.toThrow(/ainda não se organiza/i);
    expect(await listCargas(pool, id)).toEqual([]);
  });

  it('o pai genérico não vai no caminhão: quem vai são os filhos', async () => {
    const { id } = await tx((client) =>
      criarPedido(client, {
        clienteId: cliente,
        canal: 'compensacao',
        dataEntrega: null,
        observacoes: null,
        criadoPor: usuario,
        itens: [
          {
            especieId: null,
            recipienteId: tubete,
            quantidade: 500,
            precoCentavos: 200,
            generico: true,
            especificacao: '500 nativas',
          },
        ],
      }),
    );
    await tx((c) => iniciarVerificacao(c, id, gerencia()));
    const [pai] = await listItens(pool, id);
    await tx((c) =>
      definirComposicaoGenerico(c, id, pai.id, [
        { especieId: especie, recipienteId: tubete, quantidade: 300 },
        { especieId: outraEspecie, recipienteId: tubete, quantidade: 200 },
      ], gerencia()),
    );
    await tx((c) => concluirVerificacao(c, id, gerencia()));
    await tx((c) => confirmarPedido(c, id, chefia()));
    await tx((c) => criarCargaUnica(c, id, gerencia()));

    const [carga] = await listCargas(pool, id);
    expect(carga.itens).toHaveLength(2);
    expect(carga.itens.map((i) => i.itemId)).not.toContain(pai.id);
    expect(carga.itens.map((i) => i.quantidade).sort((a, b) => a - b)).toEqual([200, 300]);
  });

  it('divide em duas viagens quando cada item fecha', async () => {
    const id = await pedidoAprovado();
    const [grande, pequeno] = [...(await listItens(pool, id))].sort((a, b) => b.quantidade - a.quantidade);

    await tx((c) =>
      criarCargas(
        c,
        id,
        [
          [
            { itemId: grande.id, quantidade: 300 },
            { itemId: pequeno.id, quantidade: 200 },
          ],
          [{ itemId: grande.id, quantidade: 200 }],
        ],
        gerencia(),
      ),
    );

    const cargas = await listCargas(pool, id);
    expect(cargas.map((c) => c.numero)).toEqual([1, 2]);
    expect(cargas[0].itens).toHaveLength(2);
    expect(cargas[1].itens).toHaveLength(1);
  });

  it('item que não fecha é recusado, e nenhuma carga é criada', async () => {
    const id = await pedidoAprovado();
    const [grande, pequeno] = [...(await listItens(pool, id))].sort((a, b) => b.quantidade - a.quantidade);

    await expect(
      tx((c) =>
        criarCargas(
          c,
          id,
          [
            [
              { itemId: grande.id, quantidade: 450 },
              { itemId: pequeno.id, quantidade: 200 },
            ],
          ],
          gerencia(),
        ),
      ),
    ).rejects.toThrow(/não bate com o total/i);

    expect(await listCargas(pool, id)).toEqual([]);
    expect((await findPedido(pool, id))!.situacao).toBe('aprovado');
  });

  it('a carga que ficou sem item é descartada, e as demais renumeradas em sequência', async () => {
    const id = await pedidoAprovado();
    const [grande, pequeno] = [...(await listItens(pool, id))].sort((a, b) => b.quantidade - a.quantidade);

    // A do meio ficou zerada: quem estava decidindo abriu três e usou duas
    await tx((c) =>
      criarCargas(
        c,
        id,
        [
          [{ itemId: grande.id, quantidade: 500 }],
          [{ itemId: grande.id, quantidade: 0 }],
          [{ itemId: pequeno.id, quantidade: 200 }],
        ],
        gerencia(),
      ),
    );

    const cargas = await listCargas(pool, id);
    expect(cargas.map((c) => c.numero)).toEqual([1, 2]);
    expect(cargas[1].itens[0].quantidade).toBe(200);
  });
});

describe('contar e concluir (T8.13)', () => {
  async function emSeparacao() {
    const id = await pedidoAprovado();
    await tx((c) => criarCargaUnica(c, id, gerencia()));
    const [carga] = await listCargas(pool, id);
    return { id, carga };
  }

  it('marcar grava o valor final, e desmarcar volta atrás', async () => {
    const { id, carga } = await emSeparacao();
    const [item] = porEspecie(carga.itens);

    await tx((c) => marcarItemSeparado(c, item.id, true));
    // Repetir não inverte: é o que vai permitir a fila offline
    await tx((c) => marcarItemSeparado(c, item.id, true));
    expect((await listCargas(pool, id))[0].itens.find((i) => i.id === item.id)!.separado).toBe(true);

    await tx((c) => marcarItemSeparado(c, item.id, false));
    expect((await listCargas(pool, id))[0].itens.find((i) => i.id === item.id)!.separado).toBe(false);
  });

  it('carga com item por contar não fecha', async () => {
    const { id, carga } = await emSeparacao();
    await tx((c) => marcarItemSeparado(c, carga.itens[0].id, true));

    await expect(tx((c) => concluirCarga(c, carga.id, gerencia()))).rejects.toThrow(/por separar/i);
    expect((await findPedido(pool, id))!.situacao).toBe('separando');
    expect((await listCargas(pool, id))[0].situacao).toBe('pendente');
  });

  it('com tudo separado, a carga única leva o pedido a pronto para envio', async () => {
    const { id, carga } = await emSeparacao();
    for (const item of carga.itens) await tx((c) => marcarItemSeparado(c, item.id, true));

    const resultado = await tx((c) => concluirCarga(c, carga.id, gerencia()));
    expect(resultado).toMatchObject({ numero: 1, pedidoPronto: true });
    expect((await findPedido(pool, id))!.situacao).toBe('pronto_envio');
  });

  it('o pedido só fica pronto na última carga', async () => {
    const id = await pedidoAprovado();
    const [grande, pequeno] = [...(await listItens(pool, id))].sort((a, b) => b.quantidade - a.quantidade);
    await tx((c) =>
      criarCargas(
        c,
        id,
        [[{ itemId: grande.id, quantidade: 500 }], [{ itemId: pequeno.id, quantidade: 200 }]],
        gerencia(),
      ),
    );
    const [primeira, segunda] = await listCargas(pool, id);

    for (const item of primeira.itens) await tx((c) => marcarItemSeparado(c, item.id, true));
    expect(await tx((c) => concluirCarga(c, primeira.id, gerencia()))).toMatchObject({ pedidoPronto: false });
    expect((await findPedido(pool, id))!.situacao).toBe('separando');

    for (const item of segunda.itens) await tx((c) => marcarItemSeparado(c, item.id, true));
    expect(await tx((c) => concluirCarga(c, segunda.id, gerencia()))).toMatchObject({ pedidoPronto: true });
    expect((await findPedido(pool, id))!.situacao).toBe('pronto_envio');
  });

  it('carga pronta não fecha de novo, e nem aceita desmarcar item', async () => {
    const { carga } = await emSeparacao();
    for (const item of carga.itens) await tx((c) => marcarItemSeparado(c, item.id, true));
    await tx((c) => concluirCarga(c, carga.id, gerencia()));

    await expect(tx((c) => concluirCarga(c, carga.id, gerencia()))).rejects.toThrow(/já está pronta/i);
    await expect(tx((c) => marcarItemSeparado(c, carga.itens[0].id, false))).rejects.toThrow(/não pode mais ser marcado/i);
  });
});

describe('o que há para entregar no período (T8.15)', () => {
  it('traz o pedido aprovado com o progresso de cargas, e ignora o que não está no fluxo', async () => {
    const hoje = hojeNoViveiro();
    const entrega = somaDias(hoje, 2);
    const id = await pedidoAprovado(entrega);
    await tx((c) => criarCargaUnica(c, id, gerencia()));

    const noPeriodo = await pedidosDoPeriodo(pool, hoje, somaDias(hoje, 30));
    const meu = noPeriodo.find((p) => p.id === id)!;
    expect(meu).toMatchObject({ dataEntrega: entrega, cargas: 1, prontas: 0, situacao: 'separando' });

    // Fora da janela, não aparece
    expect((await pedidosDoPeriodo(pool, somaDias(hoje, 10), somaDias(hoje, 20))).map((p) => p.id)).not.toContain(id);
  });

  it('pedido sem data de entrega não entra no calendário', async () => {
    const id = await pedidoAprovado(null);
    const noPeriodo = await pedidosDoPeriodo(pool, somaDias(hojeNoViveiro(), -365), somaDias(hojeNoViveiro(), 365));
    expect(noPeriodo.map((p) => p.id)).not.toContain(id);
  });
});
