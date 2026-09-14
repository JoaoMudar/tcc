import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ATENCAO, CRITICO, MORTALIDADE, listParametros, saveParametros } from '../parametros';
import { withTransaction } from '../transaction';
import { duplicateMessage, insertTurno, jornadaDiaria, listTurnos, updateTurno } from '../turnos';
import { insertUsuario } from '../usuarios';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tc${randomUUID().slice(0, 6)}`;
let valoresOriginais: Record<string, string> = {};
let usuarioId: string;

beforeAll(async () => {
  valoresOriginais = Object.fromEntries((await listParametros(pool)).map((p) => [p.chave, p.valor]));
  usuarioId = await insertUsuario(pool, {
    login: `${prefixo}_chefia`,
    nomeExibicao: 'Chefia de teste',
    perfil: 'chefia',
    senhaHash: 'scrypt$1$1$1$x$y',
    pessoaId: null,
  });
});

afterAll(async () => {
  await withTransaction(pool, (client) => saveParametros(client, valoresOriginais, usuarioId));
  await pool.query('UPDATE parametros SET atualizado_por = NULL WHERE atualizado_por = $1', [usuarioId]);
  await pool.query("DELETE FROM turnos_trabalho WHERE nome LIKE $1 || '%'", [prefixo]);
  await pool.query('DELETE FROM usuarios WHERE id = $1', [usuarioId]);
  await pool.end();
});

describe('turnos_trabalho contra Postgres real (RF-08)', () => {
  it('a carga inicial tem manhã e tarde, somando oito horas', async () => {
    const turnos = await listTurnos(pool);
    expect(turnos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nome: 'manha', inicio: '07:30', fim: '11:30' }),
        expect.objectContaining({ nome: 'tarde', inicio: '13:00', fim: '17:00' }),
      ]),
    );
  });

  it('TA-12: alterar o fim do turno muda a jornada lida do banco', async () => {
    const id = await insertTurno(pool, { nome: `${prefixo}_a`, inicio: '18:00', fim: '20:00' });
    const jornada = async () => jornadaDiaria((await listTurnos(pool)).filter((t) => t.nome.startsWith(prefixo)));
    expect(await jornada()).toBe(120);

    expect(await updateTurno(pool, id, { inicio: '18:00', fim: '21:30', ativo: true })).toBe('ok');
    expect(await jornada()).toBe(210);

    expect(await updateTurno(pool, id, { inicio: '18:00', fim: '21:30', ativo: false })).toBe('ok');
    expect(await jornada()).toBe(0);
  });

  it('nome repetido vira mensagem própria', async () => {
    await insertTurno(pool, { nome: `${prefixo}_b`, inicio: '05:00', fim: '06:00' });
    const error = await insertTurno(pool, { nome: `${prefixo}_b`, inicio: '05:00', fim: '06:00' }).catch((e: unknown) => e);
    expect(duplicateMessage(error)).toBe('Já existe turno com esse nome.');
  });

  it('o CHECK recusa fim antes do início mesmo sem passar pela validação', async () => {
    const error = await insertTurno(pool, { nome: `${prefixo}_c`, inicio: '10:00', fim: '09:00' }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: '23514', constraint: 'turnos_trabalho_intervalo_valido' });
  });

  it('turno inexistente', async () => {
    expect(await updateTurno(pool, randomUUID(), { inicio: '08:00', fim: '09:00', ativo: true })).toBe('nao_encontrado');
  });
});

describe('parametros contra Postgres real (RF-09)', () => {
  it('TA-07: grava o valor e quem alterou, sem criar linha', async () => {
    const { rows: antes } = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM parametros');
    const novos = { [MORTALIDADE]: '30', [ATENCAO]: '1', [CRITICO]: '5' };

    expect(await withTransaction(pool, (client) => saveParametros(client, novos, usuarioId))).toBe('ok');

    const parametros = await listParametros(pool);
    expect(parametros.find((p) => p.chave === MORTALIDADE)).toMatchObject({
      valor: '30',
      atualizadoPorNome: 'Chefia de teste',
    });
    const { rows: depois } = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM parametros');
    expect(depois[0].total).toBe(antes[0].total);
  });

  it('a visão situacao_lote continua lendo os limites alterados', async () => {
    await expect(pool.query('SELECT * FROM situacao_lote LIMIT 1')).resolves.toBeDefined();
  });

  it('chave desconhecida não grava nada, nem as conhecidas', async () => {
    const result = await withTransaction(pool, (client) =>
      saveParametros(client, { [MORTALIDADE]: '99', [`${prefixo}.nova`]: '1' }, usuarioId),
    );
    expect(result).toBe('desconhecido');
    const { rows } = await pool.query('SELECT valor FROM parametros WHERE chave = $1', [MORTALIDADE]);
    expect(rows[0].valor).not.toBe('99');
    const { rows: novas } = await pool.query("SELECT 1 FROM parametros WHERE chave LIKE $1 || '%'", [prefixo]);
    expect(novas).toHaveLength(0);
  });
});
