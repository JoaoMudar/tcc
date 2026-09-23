import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertArea, insertCanteiro, listAreas } from '../areas';
import { hojeNoViveiro, somaDias } from '../datas';
import { criarLote } from '../lotes';
import { listLotesDoMapa, montarMapa, pedemProvidencia, textoPendencia } from '../mapa';
import { registrarMovimento } from '../movimentos';
import { MORTALIDADE } from '../parametros';
import { acimaDoLimite, limiteMortalidade } from '../perdas';
import { insertEtapa, insertProtocolo } from '../protocolos';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

/**
 * O mapa contra Postgres real (T7.1 a T7.3). O que se confere aqui é a ponta que
 * o teste puro não alcança: que a cor vem mesmo da visão `situacao_lote`, e não
 * de coluna nenhuma, e que a taxa de mortalidade sai das perdas gravadas.
 */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tm${randomUUID().slice(0, 6)}`;
const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);

const canteiro: Record<number, string> = {};
let usuario: string;
let especie: string;
let tubete: string;
let protocolo: string;

function novoLote(quantidade: number, numeroCanteiro: number, dataCriacao: string) {
  return tx((client) =>
    criarLote(client, {
      especieId: especie,
      recipienteId: tubete,
      canteiroId: canteiro[numeroCanteiro],
      quantidade,
      dataCriacao,
      observacoes: null,
      registradoPor: usuario,
    }),
  );
}

/** A área deste teste, já montada: o resto do banco não é assunto dele. */
async function areaDoTeste() {
  const mapa = montarMapa(await listAreas(pool), await listLotesDoMapa(pool));
  return mapa.find((area) => area.letra === 'M')!;
}

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Gerência de teste', 'x', 'gerencia', false) RETURNING id`,
    [prefixo],
  );
  usuario = rows[0].id;

  const area = await insertArea(pool, { letra: 'M', nome: 'Mapa' });
  for (const numero of [1, 2, 3]) {
    canteiro[numero] = (await insertCanteiro(pool, { areaId: area, numero, capacidade: null }))!;
  }

  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [
    `${prefixo} Cedrela`,
  ]));
  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });

  const { rows: turno } = await pool.query<{ id: string }>("SELECT id FROM turnos_trabalho WHERE nome = 'manha'");
  const { rows: tipo } = await pool.query<{ id: string }>(
    `INSERT INTO tipos_tarefa (nome, categoria, exige_lote) VALUES ($1, 'manutencao', true) RETURNING id`,
    [`${prefixo} Limpar`],
  );

  // Um protocolo de uma etapa só: a limpeza que vence 90 dias depois da criação
  protocolo = await insertProtocolo(pool, { recipienteId: tubete, nome: `${prefixo} tubete`, observacoes: null }, usuario);
  await insertEtapa(pool, protocolo, {
    tipoTarefaId: tipo[0].id,
    rotulo: 'Limpar mato',
    tipoAgendamento: 'recorrente',
    tipoAncora: 'criacao_do_lote',
    etapaAncoraId: null,
    dias: 90,
    intervaloDias: 90,
    turnoId: turno[0].id,
    alertaLigado: true,
    janelaAvisoPct: null,
    faseResultante: null,
  });
});

afterAll(async () => {
  const lotes = 'SELECT id FROM lotes WHERE especie_id = $1';
  await pool.query(`DELETE FROM lotes_etapas WHERE lote_id IN (${lotes})`, [especie]);
  await pool.query(`DELETE FROM movimentos_lote WHERE lote_id IN (${lotes})`, [especie]);
  await pool.query('DELETE FROM lotes WHERE especie_id = $1', [especie]);
  await pool.query('DELETE FROM protocolos_etapas WHERE protocolo_id = $1', [protocolo]);
  await pool.query('DELETE FROM protocolos WHERE id = $1', [protocolo]);
  await pool.query('DELETE FROM especies WHERE id = $1', [especie]);
  await pool.query('DELETE FROM recipientes WHERE id = $1', [tubete]);
  await pool.query("DELETE FROM areas WHERE letra = 'M'");
  await pool.query('DELETE FROM tipos_tarefa WHERE nome = $1', [`${prefixo} Limpar`]);
  await pool.query('DELETE FROM usuarios WHERE id = $1', [usuario]);
  await pool.end();
});

describe('TA-47, RF-44: o mapa por área e canteiro', () => {
  it('o canteiro com seis lotes apresenta os seis, e os livres se distinguem dos ocupados', async () => {
    const hoje = hojeNoViveiro();
    for (let i = 0; i < 6; i += 1) await novoLote(100, 1, hoje);
    await novoLote(100, 2, hoje);

    const area = await areaDoTeste();
    expect(area.canteiros.map((c) => c.lotes.length)).toEqual([6, 1, 0]);
    // O canteiro 3 nunca recebeu lote, e é o que aparece livre
    expect(area.canteiros.map((c) => c.livre)).toEqual([false, false, true]);
    expect(area.ocupados).toBe(2);

    // A posição dentro do canteiro é o que faz o lote ser reconhecido pelo lugar
    expect(area.canteiros[0].lotes.map((l) => l.posicao)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('o lote zerado sai do mapa e larga o canteiro (RF-33)', async () => {
    const hoje = hojeNoViveiro();
    const { id } = await novoLote(80, 3, hoje);
    expect((await areaDoTeste()).canteiros[2].livre).toBe(false);

    await tx((client) =>
      registrarMovimento(client, { loteId: id, tipo: 'perda', quantidade: -80, causa: 'geada', registradoPor: usuario }),
    );

    const area = await areaDoTeste();
    expect(area.canteiros[2].livre).toBe(true);
    expect(area.canteiros[2].lotes).toEqual([]);
  });
});

describe('TA-48, RF-45: a situação sai da visão, e ninguém a digita', () => {
  it('a etapa vencida há cinco dias deixa o lote crítico, com a tarefa e o atraso', async () => {
    const hoje = hojeNoViveiro();
    // A limpeza conta 90 dias da criação: criado há 95, ela venceu há 5
    const { id, codigo } = await novoLote(1000, 2, somaDias(hoje, -95));

    // Nada foi lançado na agenda: a cobrança é do protocolo (RN-41)
    const { rows } = await pool.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM atribuicoes WHERE lote_id = $1', [id]);
    expect(rows[0].n).toBe(0);

    const lote = (await listLotesDoMapa(pool)).find((l) => l.id === id)!;
    expect(lote).toMatchObject({ situacao: 'critico', tarefaPendente: 'Limpar mato', diasAtraso: 5 });
    expect(textoPendencia(lote, hoje)).toBe('Limpar mato, atrasada 5 dias');

    // E é ele que encabeça a lista de quem pede providência
    const providencia = pedemProvidencia(await listLotesDoMapa(pool));
    expect(providencia[0].codigo).toBe(codigo);
  });

  it('o lote sem etapa vencida aparece saudável, e sem tarefa nenhuma a mostrar', async () => {
    const { id } = await novoLote(500, 1, hojeNoViveiro());
    const lote = (await listLotesDoMapa(pool)).find((l) => l.id === id)!;

    expect(lote).toMatchObject({ situacao: 'saudavel', tarefaPendente: null, diasAtraso: 0 });
    expect(textoPendencia(lote, hojeNoViveiro())).toBeNull();
  });
});

describe('TA-24 e TA-25, RF-42: a mortalidade no mapa', () => {
  it('a taxa é as perdas sobre a quantidade inicial, e o limite que destaca é parâmetro', async () => {
    const hoje = hojeNoViveiro();
    const { id } = await novoLote(1000, 1, hoje);
    await tx((client) =>
      registrarMovimento(client, { loteId: id, tipo: 'perda', quantidade: -240, causa: 'seca', registradoPor: usuario }),
    );

    const lote = (await listLotesDoMapa(pool)).find((l) => l.id === id)!;
    expect(lote).toMatchObject({ perdas: 240, quantidadeInicial: 1000, taxa: 0.24 });

    // TA-24: com o limite em 20%, o lote é destacado
    const original = await limiteMortalidade(pool);
    expect(acimaDoLimite(lote.taxa, 20)).toBe(true);

    // TA-25: alterado o limite para 30%, o destaque some sem que nada no lote mude
    try {
      await pool.query('UPDATE parametros SET valor = $2 WHERE chave = $1', [MORTALIDADE, '30']);
      expect(await limiteMortalidade(pool)).toBe(30);

      const mesmoLote = (await listLotesDoMapa(pool)).find((l) => l.id === id)!;
      expect(mesmoLote.taxa).toBe(0.24);
      expect(acimaDoLimite(mesmoLote.taxa, await limiteMortalidade(pool))).toBe(false);
    } finally {
      await pool.query('UPDATE parametros SET valor = $2 WHERE chave = $1', [MORTALIDADE, String(original)]);
    }

    // A mortalidade não entra na cor: o lote destacado por perda segue saudável de tarefa
    expect(lote.situacao).toBe('saudavel');
  });
});
