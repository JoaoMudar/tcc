import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { confirmarAtribuicao, criarAtribuicoes, findAtribuicao } from '../agenda';
import { insertArea, insertCanteiro } from '../areas';
import { executarUmaVez } from '../envios';
import { criarLote, findLote, listMovimentos, saldoDosMovimentos } from '../lotes';
import { registrarMovimento } from '../movimentos';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

/**
 * UC-20 FA-3 e RNF-05 contra Postgres real: o reenvio da fila do aparelho não
 * duplica a perda nem a confirmação, e a soma dos movimentos continua fechando
 * com o saldo (TA-64).
 */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `te${randomUUID().slice(0, 6)}`;
// Semana que nenhuma outra suíte usa: segunda-feira, 2032
const SEMANA = '2032-03-01';

let usuario: string;
let outroUsuario: string;
let especie: string;
let tubete: string;
let canteiro: string;
let lote: string;
let manha: string;
let rogerio: string;
let classificar: string;

const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);

async function novoUsuario(sufixo: string) {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Gerência de teste', 'x', 'gerencia', false) RETURNING id`,
    [`${prefixo}${sufixo}`],
  );
  return rows[0].id;
}

/** O que `registros-campo` faz com a perda: a chave e o movimento na mesma transação. */
function perda(chave: string, quantidade: number, quem = usuario) {
  return tx((client) =>
    executarUmaVez(client, { chave, tipo: 'perda', usuarioId: quem }, async () => {
      const { saldo } = await registrarMovimento(client, {
        loteId: lote,
        tipo: 'perda',
        quantidade: -quantidade,
        causa: 'seca',
        registradoPor: quem,
      });
      return { success: `Perda de ${quantidade}. O lote fica com ${saldo}.` };
    }),
  );
}

/** RF-35 em todo teste: a soma dos movimentos reproduz o saldo gravado. */
async function saldoConferido() {
  const ficha = await findLote(pool, lote);
  expect(saldoDosMovimentos(await listMovimentos(pool, lote))).toBe(ficha!.quantidadeAtual);
  return ficha!.quantidadeAtual;
}

async function contarPerdas(atribuicaoId: string | null = null) {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM movimentos_lote
      WHERE lote_id = $1 AND tipo_movimento = 'perda' AND atribuicao_id IS NOT DISTINCT FROM $2`,
    [lote, atribuicaoId],
  );
  return rows[0].n;
}

beforeAll(async () => {
  usuario = await novoUsuario('a');
  outroUsuario = await novoUsuario('b');
  const area = await insertArea(pool, { letra: 'Q', nome: null });
  canteiro = (await insertCanteiro(pool, { areaId: area, numero: 1, capacidade: null }))!;
  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [`${prefixo} Euterpe`]));
  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
  ({ id: lote } = await tx((client) =>
    criarLote(client, {
      especieId: especie,
      recipienteId: tubete,
      canteiroId: canteiro,
      quantidade: 500,
      dataCriacao: '2032-01-10',
      observacoes: null,
      registradoPor: usuario,
    }),
  ));
  const turnos = await pool.query<{ id: string }>("SELECT id FROM turnos_trabalho WHERE nome = 'manha'");
  manha = turnos.rows[0].id;
  const pessoa = await pool.query<{ id: string }>("INSERT INTO cadastro.pessoas (tipo, nome) VALUES ('pf', $1) RETURNING id", [
    `${prefixo} Rogério`,
  ]);
  rogerio = pessoa.rows[0].id;
  await pool.query("INSERT INTO cadastro.pessoas_papeis (pessoa_id, papel, tipo_vinculo, ativo) VALUES ($1, 'funcionario', 'fixo', true)", [
    rogerio,
  ]);
  const tipo = await pool.query<{ id: string }>(
    `INSERT INTO tipos_tarefa (nome, categoria, e_quantitativa, exige_lote, exige_recipiente)
     VALUES ($1, 'manutencao', true, true, false) RETURNING id`,
    [`${prefixo} Classificação`],
  );
  classificar = tipo.rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

describe('chave de idempotência (T9.3) contra Postgres real', () => {
  it('UC-20 FA-3: a perda reenviada com a mesma chave baixa uma vez só, e responde igual', async () => {
    const chave = randomUUID();
    const primeira = await perda(chave, 30);
    const segunda = await perda(chave, 30);

    expect(primeira).toEqual({ resposta: { success: 'Perda de 30. O lote fica com 470.' }, repetido: false });
    expect(segunda).toEqual({ resposta: primeira.resposta, repetido: true });
    expect(await saldoConferido()).toBe(470);
    expect(await contarPerdas()).toBe(1);
  });

  it('dois envios simultâneos da mesma chave: um grava, o outro espera e recebe a resposta', async () => {
    const chave = randomUUID();
    const [a, b] = await Promise.all([perda(chave, 20), perda(chave, 20)]);
    expect([a.repetido, b.repetido].sort()).toEqual([false, true]);
    expect(await saldoConferido()).toBe(450);
  });

  it('registro recusado não guarda a chave: o reenvio encontra a mesma recusa', async () => {
    const chave = randomUUID();
    await expect(perda(chave, 9999)).rejects.toThrow(/Não dá para baixar/);
    await expect(perda(chave, 9999)).rejects.toThrow(/Não dá para baixar/);
    const { rows } = await pool.query('SELECT 1 FROM envios_recebidos WHERE chave = $1', [chave]);
    expect(rows).toHaveLength(0);
  });

  it('a chave de outro usuário é recusada, e não devolve a resposta dele', async () => {
    const chave = randomUUID();
    await perda(chave, 10);
    await expect(perda(chave, 10, outroUsuario)).rejects.toThrow(/não confere/);
    expect(await saldoConferido()).toBe(440);
  });

  it('a confirmação reenviada não é recusada por já estar confirmada, e não duplica a perda da tarefa', async () => {
    const [id] = await tx((client) =>
      criarAtribuicoes(client, {
        semana: SEMANA,
        dias: [SEMANA],
        turnoId: manha,
        tipoTarefaId: classificar,
        horaInicio: null,
        horaFim: null,
        participantes: [rogerio],
        loteId: lote,
        especieId: null,
        recipienteId: null,
        areaId: null,
        canteiroId: null,
        quantidadePlanejada: null,
        recorrente: false,
        observacoes: null,
        loteEtapaId: null,
      }),
    );
    const chave = randomUUID();
    const confirmar = () =>
      tx((client) =>
        executarUmaVez(client, { chave, tipo: 'confirmacao_tarefa', usuarioId: usuario }, async () => {
          await confirmarAtribuicao(
            client,
            id,
            {
              loteId: lote,
              areaId: null,
              canteiroId: null,
              quantidades: [{ pessoaId: rogerio, quantidade: 300 }],
              perda: { quantidade: 15, causa: 'seca' },
            },
            usuario,
          );
          return { success: 'Tarefa confirmada.', destino: `/producao/agenda/${id}?feito=confirmada` };
        }),
      );

    await confirmar();
    const reenvio = await confirmar();
    expect(reenvio).toEqual({ resposta: { success: 'Tarefa confirmada.', destino: `/producao/agenda/${id}?feito=confirmada` }, repetido: true });
    expect((await findAtribuicao(pool, id))?.situacao).toBe('confirmada');
    expect(await saldoConferido()).toBe(425);
    expect(await contarPerdas(id)).toBe(1);
  });
});
