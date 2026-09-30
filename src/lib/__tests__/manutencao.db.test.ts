import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertArea, insertCanteiro } from '../areas';
import { hojeNoViveiro } from '../datas';
import { criarLote } from '../lotes';
import { aplicarRetencao, conferirIntegridade } from '../manutencao';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

/** T10.1 e T10.2 contra Postgres real: a retenção do E5 e a conferência do E6 §4. */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tm${randomUUID().slice(0, 6)}`;
const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);
const AGORA = new Date('2031-06-15T12:00:00Z');

let usuario: string;

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Manutenção de teste', 'x', 'gerencia', false) RETURNING id`,
    [prefixo],
  );
  usuario = rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

describe('retenção (E5 §2.3)', () => {
  it('apaga o registro de acesso com mais de 12 meses e a sessão expirada, e guarda o resto', async () => {
    const evento = (quando: string) =>
      pool.query('INSERT INTO eventos_login (login_tentado, sucesso, criado_em) VALUES ($1, false, $2)', [`${prefixo}${quando}`, quando]);
    await evento('2030-05-01T00:00:00Z'); // 13 meses e meio antes: sai
    await evento('2030-07-01T00:00:00Z'); // 11 meses e meio antes: fica

    const sessao = (sufixo: string, expira: string) =>
      pool.query('INSERT INTO sessoes (usuario_id, token_hash, expira_em) VALUES ($1, $2, $3)', [usuario, `${prefixo}${sufixo}`, expira]);
    await sessao('vencida', '2031-06-14T00:00:00Z');
    await sessao('valida', '2031-07-14T00:00:00Z');

    const resultado = await aplicarRetencao(pool, AGORA);
    expect(resultado.eventosLogin).toBeGreaterThanOrEqual(1);
    expect(resultado.sessoesVencidas).toBeGreaterThanOrEqual(1);

    const eventos = await pool.query('SELECT login_tentado FROM eventos_login WHERE login_tentado LIKE $1', [`${prefixo}%`]);
    expect(eventos.rows).toEqual([{ login_tentado: `${prefixo}2030-07-01T00:00:00Z` }]);
    const sessoes = await pool.query('SELECT token_hash FROM sessoes WHERE usuario_id = $1', [usuario]);
    expect(sessoes.rows).toEqual([{ token_hash: `${prefixo}valida` }]);
  });
});

describe('conferência de integridade (E6 §4)', () => {
  it('conta as entidades críticas e acusa o lote cujo saldo não é a soma dos movimentos', async () => {
    const { rows } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [`${prefixo} Inga`]);
    const tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
    const area = await insertArea(pool, { letra: 'R', nome: 'Restauração' });
    const canteiro = (await insertCanteiro(pool, { areaId: area, numero: 1, capacidade: null }))!;
    const lote = await tx((client) =>
      criarLote(client, {
        especieId: rows[0].id,
        recipienteId: tubete,
        canteiroId: canteiro,
        quantidade: 300,
        dataCriacao: hojeNoViveiro(),
        observacoes: null,
        registradoPor: usuario,
      }),
    );

    const antes = await conferirIntegridade(pool);
    expect(antes.contagens.lotes).toBeGreaterThanOrEqual(1);
    expect(antes.contagens.movimentos_lote).toBeGreaterThanOrEqual(1);
    expect(antes.divergentes.map((d) => d.codigo)).not.toContain(lote.codigo);

    // Simula a corrupção que só a conferência pega: o saldo mudou sem movimento
    await pool.query('UPDATE lotes SET quantidade_atual = 290 WHERE id = $1', [lote.id]);
    const depois = await conferirIntegridade(pool);
    expect(depois.divergentes).toContainEqual({ codigo: lote.codigo, saldo: 290, somaMovimentos: 300 });

    // Devolve o lote ao estado certo: a base de teste é compartilhada entre suítes
    await pool.query('UPDATE lotes SET quantidade_atual = 300 WHERE id = $1', [lote.id]);
  });
});
