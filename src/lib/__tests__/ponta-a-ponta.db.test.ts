import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSemana, confirmarAtribuicao, criarAtribuicoes, fecharSemana, findAtribuicao, publicarSemana, type AtribuicaoInput } from '../agenda';
import { insertArea, insertCanteiro } from '../areas';
import { hojeNoViveiro } from '../datas';
import { saldoPronto } from '../estoque';
import { alterarFase, contarLote, criarLote, findLote, listMovimentos, saldoDosMovimentos } from '../lotes';
import { registrarMovimento } from '../movimentos';
import { confirmarPedido, criarPedido, findPedido, listItens, mudarSituacao } from '../pedidos';
import { insertClienteRapido } from '../pessoas';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

/**
 * T10.3: os três fluxos do sistema, encadeados sobre o mesmo lote, contra
 * Postgres real. As suítes de cada fase já conferem as peças; esta confere que
 * elas se encaixam: a perda de campo, a tarefa confirmada na semana e o saldo
 * lido pelo pedido falam do mesmo número, e a soma dos movimentos o reproduz ao
 * fim de cada passo (RN-21, TA-64).
 *
 * Os `it` rodam em ordem e cada um parte do estado que o anterior deixou.
 */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `pp${randomUUID().slice(0, 6)}`;
const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);
// Segunda-feira longe das semanas das outras suítes
const SEMANA = '2033-03-07';

let gerencia: string;
let chefia: string;
let especie: string;
let tubete: string;
let canteiro: string;
let rogerio: string;
let amelia: string;
let irrigar: string;
let manejo: string;
let cliente: string;
let lote: string;
let pedido: string;

/** O saldo do lote tem de ser a soma dos seus movimentos, em qualquer momento. */
async function saldoConferido(): Promise<number> {
  const ficha = (await findLote(pool, lote))!;
  expect(saldoDosMovimentos(await listMovimentos(pool, lote))).toBe(ficha.quantidadeAtual);
  return ficha.quantidadeAtual;
}

async function usuario(perfil: 'gerencia' | 'chefia'): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, $2, 'x', $3, false) RETURNING id`,
    [`${prefixo}${perfil}`, `${perfil} de teste`, perfil],
  );
  return rows[0].id;
}

async function funcionario(nome: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("INSERT INTO cadastro.pessoas (tipo, nome) VALUES ('pf', $1) RETURNING id", [
    `${prefixo} ${nome}`,
  ]);
  await pool.query("INSERT INTO cadastro.pessoas_papeis (pessoa_id, papel, tipo_vinculo) VALUES ($1, 'funcionario', 'fixo')", [rows[0].id]);
  return rows[0].id;
}

async function tipo(nome: string, declara: { quantitativa: boolean; lote: boolean }): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO tipos_tarefa (nome, categoria, e_quantitativa, exige_lote)
     VALUES ($1, 'manutencao', $2, $3) RETURNING id`,
    [`${prefixo} ${nome}`, declara.quantitativa, declara.lote],
  );
  return rows[0].id;
}

function tarefa(over: Partial<AtribuicaoInput>): AtribuicaoInput {
  return {
    semana: SEMANA,
    dias: [SEMANA],
    turnoId: '',
    tipoTarefaId: irrigar,
    horaInicio: null,
    horaFim: null,
    participantes: [rogerio],
    loteId: null,
    especieId: null,
    recipienteId: null,
    areaId: null,
    canteiroId: null,
    quantidadePlanejada: null,
    recorrente: false,
    observacoes: null,
    loteEtapaId: null,
    ...over,
  };
}

beforeAll(async () => {
  gerencia = await usuario('gerencia');
  chefia = await usuario('chefia');

  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [`${prefixo} Eugenia uniflora`]));
  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
  const area = await insertArea(pool, { letra: 'E', nome: 'Ponta a ponta' });
  canteiro = (await insertCanteiro(pool, { areaId: area, numero: 1, capacidade: null }))!;

  rogerio = await funcionario('Rogério');
  amelia = await funcionario('Amélia');
  irrigar = await tipo('Irrigação', { quantitativa: false, lote: false });
  manejo = await tipo('Manejo do lote', { quantitativa: true, lote: true });

  cliente = await tx((client) => insertClienteRapido(client, { nome: `${prefixo} Prefeitura`, telefone: null }));
});

afterAll(async () => {
  await pool.end();
});

describe('fluxo 1: lote e perda', () => {
  it('o lote nasce com a entrada, a perda e a contagem baixam o saldo, e a soma dos movimentos o reproduz', async () => {
    ({ id: lote } = await tx((client) =>
      criarLote(client, {
        especieId: especie,
        recipienteId: tubete,
        canteiroId: canteiro,
        quantidade: 1000,
        dataCriacao: hojeNoViveiro(),
        observacoes: null,
        registradoPor: gerencia,
      }),
    ));
    expect(await saldoConferido()).toBe(1000);

    await tx((client) => registrarMovimento(client, { loteId: lote, tipo: 'perda', quantidade: -50, causa: 'seca', registradoPor: gerencia }));
    expect(await saldoConferido()).toBe(950);

    // A contagem física achou dez a menos: vira ajuste, e não correção escondida (RN-09)
    const contagem = await tx((client) => contarLote(client, { loteId: lote, contado: 940, observacoes: null, registradoPor: gerencia }));
    expect(contagem.diferenca).toBe(-10);
    expect(await saldoConferido()).toBe(940);

    const tipos = (await listMovimentos(pool, lote)).map((m) => m.tipo).sort();
    expect(tipos).toEqual(['ajuste_contagem', 'entrada', 'perda']);
  });
});

describe('fluxo 2: semana montada e fechada', () => {
  const ids: Record<string, string> = {};

  it('a gerência monta a semana, publica e confirma a tarefa do lote com as que morreram', async () => {
    const { rows } = await pool.query<{ id: string }>("SELECT id FROM turnos_trabalho WHERE nome = 'manha'");
    const manha = rows[0].id;

    await tx((client) => abrirSemana(client, SEMANA));
    [ids.irrigacao] = await tx((client) => criarAtribuicoes(client, tarefa({ turnoId: manha, participantes: [rogerio, amelia] })));
    [ids.manejo] = await tx((client) =>
      criarAtribuicoes(client, tarefa({ turnoId: manha, tipoTarefaId: manejo, participantes: [amelia], loteId: lote })),
    );
    await tx((client) => publicarSemana(client, SEMANA, gerencia));

    await tx((client) =>
      confirmarAtribuicao(
        client,
        ids.manejo,
        { loteId: lote, areaId: null, canteiroId: null, quantidades: [{ pessoaId: amelia, quantidade: 900 }], perda: { quantidade: 20, causa: 'geada' } },
        gerencia,
      ),
    );
    expect((await findAtribuicao(pool, ids.manejo))?.situacao).toBe('confirmada');

    // A perda da tarefa entrou pela mesma porta, e aponta para a tarefa que a encontrou
    const perdaDaTarefa = await pool.query('SELECT quantidade FROM movimentos_lote WHERE lote_id = $1 AND atribuicao_id = $2', [lote, ids.manejo]);
    expect(perdaDaTarefa.rows).toEqual([{ quantidade: -20 }]);
    expect(await saldoConferido()).toBe(920);
  });

  it('fechar a semana assume a não confirmada como feita, e depois dela nada muda', async () => {
    const { naoConfirmadas } = await tx((client) => fecharSemana(client, SEMANA));
    expect(naoConfirmadas).toBe(1);
    expect((await findAtribuicao(pool, ids.irrigacao))?.situacao).toBe('nao_confirmada');

    await expect(
      tx((client) =>
        confirmarAtribuicao(client, ids.irrigacao, { loteId: null, areaId: null, canteiroId: null, quantidades: [], perda: null }, gerencia),
      ),
    ).rejects.toThrow('está fechada');
    expect(await saldoConferido()).toBe(920);
  });
});

describe('fluxo 3: pedido com saldo', () => {
  it('o saldo exibido no item sai do lote pronto, e a perda de campo o muda sem tocar o pedido', async () => {
    // Antes de pronto, o lote não é oferecido à venda (RN-06)
    expect(await saldoPronto(pool, { especieId: especie, recipienteId: tubete })).toHaveLength(0);
    await alterarFase(pool, lote, 'pronto');
    expect((await saldoPronto(pool, { especieId: especie, recipienteId: tubete }))[0].quantidade).toBe(920);

    ({ id: pedido } = await tx((client) =>
      criarPedido(client, {
        clienteId: cliente,
        canal: 'prefeitura',
        dataEntrega: null,
        observacoes: null,
        itens: [{ especieId: especie, recipienteId: tubete, quantidade: 300, precoCentavos: 450 }],
        criadoPor: chefia,
      }),
    ));

    await tx((client) => registrarMovimento(client, { loteId: lote, tipo: 'perda', quantidade: -100, causa: 'praga', registradoPor: gerencia }));
    expect((await saldoPronto(pool, { especieId: especie, recipienteId: tubete }))[0].quantidade).toBe(820);
    expect((await listItens(pool, pedido))[0].quantidade).toBe(300);
    expect(await saldoConferido()).toBe(820);
  });

  it('a gerência confere, a chefia aprova, e a saída de venda pela porta única fecha a conta do lote', async () => {
    await tx((client) => mudarSituacao(client, pedido, 'verificando', { perfil: 'gerencia', usuarioId: gerencia }));
    await tx((client) => mudarSituacao(client, pedido, 'verificado', { perfil: 'gerencia', usuarioId: gerencia }));
    await tx((client) => confirmarPedido(client, pedido, { perfil: 'chefia', usuarioId: chefia }));
    expect((await findPedido(pool, pedido))?.situacao).not.toBe('cadastrado');

    // Nenhuma tela grava a saída de venda ainda (RF-37): a porta a aceita, e o saldo acompanha
    await tx((client) => registrarMovimento(client, { loteId: lote, tipo: 'venda', quantidade: -300, registradoPor: chefia }));
    expect((await saldoPronto(pool, { especieId: especie, recipienteId: tubete }))[0].quantidade).toBe(520);
    expect(await saldoConferido()).toBe(520);
  });
});
