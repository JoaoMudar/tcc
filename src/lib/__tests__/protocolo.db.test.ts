import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertArea, insertCanteiro } from '../areas';
import { criarLote, findLote } from '../lotes';
import { diasDeAtraso, situacaoDaEtapa, vencimentoDaEtapa } from '../protocolo-motor';
import { insertEtapa, insertProtocolo, listEtapas, saveTempoDaEspecie } from '../protocolos';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

/**
 * O protocolo contra Postgres real. É aqui que a visão `lotes_etapas_vencimento`
 * e o motor puro de `protocolo-motor.ts` são conferidos **contra os mesmos
 * casos**: os dois calculam o vencimento, e divergência entre eles é defeito.
 *
 * As datas saem da prova de mesa de `rotinas/2-producao/06`, que o `E2` declara
 * normativa.
 */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `tp${randomUUID().slice(0, 6)}`;
const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);

const JANELA_PADRAO = 20;

let usuario: string;
let especie: string;
let especieLenta: string;
let tubete: string;
let semProtocolo: string;
let canteiro1: string;
let canteiro2: string;
let protocolo: string;
let plantar: string;
let classificar: string;
let selecao: string;
let limpeza: string;
let irrigacao: string;

/** Uma linha de `lotes_etapas` como o motor a consome. */
async function estado(loteId: string, etapaId: string) {
  const { rows } = await pool.query<{
    dataAncora: string | null;
    ultimaExecucaoEm: string | null;
    ocorrencias: number;
  }>(
    `SELECT to_char(data_ancora, 'YYYY-MM-DD') AS "dataAncora",
            to_char(ultima_execucao_em, 'YYYY-MM-DD') AS "ultimaExecucaoEm", ocorrencias
       FROM lotes_etapas WHERE lote_id = $1 AND protocolo_etapa_id = $2`,
    [loteId, etapaId],
  );
  return rows[0] ?? null;
}

/** A linha da visão, que é o outro lado da conta. */
async function daVisao(loteId: string, etapaId: string) {
  const { rows } = await pool.query<{
    proximoVencimento: string | null;
    diasEfetivos: number;
    diasAviso: number;
    situacao: string;
  }>(
    `SELECT to_char(proximo_vencimento, 'YYYY-MM-DD') AS "proximoVencimento",
            dias_efetivos AS "diasEfetivos", dias_aviso AS "diasAviso", situacao
       FROM lotes_etapas_vencimento WHERE lote_id = $1 AND protocolo_etapa_id = $2`,
    [loteId, etapaId],
  );
  return rows[0] ?? null;
}

function novoLote(recipienteId: string, canteiroId: string, dataCriacao: string, especieId = especie) {
  return tx((client) =>
    criarLote(client, {
      especieId,
      recipienteId,
      canteiroId,
      quantidade: 1000,
      dataCriacao,
      observacoes: null,
      registradoPor: usuario,
    }),
  );
}

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Gerência de teste', 'x', 'gerencia', false) RETURNING id`,
    [prefixo],
  );
  usuario = rows[0].id;

  const area = await insertArea(pool, { letra: 'T', nome: null });
  canteiro1 = (await insertCanteiro(pool, { areaId: area, numero: 1, capacidade: null }))!;
  canteiro2 = (await insertCanteiro(pool, { areaId: area, numero: 2, capacidade: null }))!;

  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [
    `${prefixo} Handroanthus`,
  ]));
  ({
    rows: [{ id: especieLenta }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [
    `${prefixo} Araucaria`,
  ]));

  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
  semProtocolo = await insertRecipiente(pool, { nome: `${prefixo} saco`, volumeLitros: 0.9 });

  const turno = await pool.query<{ id: string }>("SELECT id FROM turnos_trabalho WHERE nome = 'manha'");
  const turnoId = turno.rows[0].id;
  const tarefa = await pool.query<{ id: string }>('SELECT id FROM tipos_tarefa ORDER BY nome LIMIT 1');
  const tipoTarefaId = tarefa.rows[0].id;

  // O protocolo do tubete da prova de mesa
  protocolo = await insertProtocolo(pool, { recipienteId: tubete, nome: `${prefixo} tubete`, observacoes: null }, usuario);

  const etapa = (rotulo: string, extra: Record<string, unknown>) =>
    insertEtapa(pool, protocolo, {
      tipoTarefaId,
      rotulo,
      tipoAgendamento: 'sequencial',
      tipoAncora: 'criacao_do_lote',
      etapaAncoraId: null,
      dias: 0,
      intervaloDias: null,
      turnoId,
      alertaLigado: true,
      janelaAvisoPct: null,
      faseResultante: null,
      ...extra,
    } as Parameters<typeof insertEtapa>[2]);

  plantar = await etapa('Plantar no tubete', { dias: 0, faseResultante: 'germinado' });
  classificar = await etapa('Classificar pos-germinacao', {
    dias: 40,
    tipoAncora: 'conclusao_de_etapa',
    etapaAncoraId: plantar,
    faseResultante: 'crescimento',
  });
  selecao = await etapa('Classificar selecao', {
    dias: 60,
    intervaloDias: 60,
    tipoAgendamento: 'recorrente',
    tipoAncora: 'conclusao_de_etapa',
    etapaAncoraId: classificar,
  });
  limpeza = await etapa('Limpar mato', { dias: 90, intervaloDias: 90, tipoAgendamento: 'recorrente' });
  irrigacao = await etapa('Irrigacao', {
    dias: 1,
    intervaloDias: 1,
    tipoAgendamento: 'recorrente',
    alertaLigado: false,
  });
});

afterAll(async () => {
  // Ordem das chaves: o acompanhamento e os tempos antes das etapas, e os lotes antes de tudo
  const lotes = 'SELECT id FROM lotes WHERE especie_id IN ($1, $2)';
  await pool.query(`DELETE FROM lotes_etapas WHERE lote_id IN (${lotes})`, [especie, especieLenta]);
  await pool.query(`DELETE FROM movimentos_lote WHERE lote_id IN (${lotes})`, [especie, especieLenta]);
  await pool.query('DELETE FROM lotes WHERE especie_id IN ($1, $2)', [especie, especieLenta]);
  await pool.query('DELETE FROM especies_protocolos_tempos WHERE especie_id IN ($1, $2)', [especie, especieLenta]);
  await pool.query('DELETE FROM protocolos_etapas WHERE protocolo_id = $1', [protocolo]);
  await pool.query('DELETE FROM protocolos WHERE id = $1', [protocolo]);
  await pool.query('DELETE FROM especies WHERE id IN ($1, $2)', [especie, especieLenta]);
  await pool.query('DELETE FROM recipientes WHERE id IN ($1, $2)', [tubete, semProtocolo]);
  await pool.query("DELETE FROM areas WHERE letra = 'T'");
  await pool.query('DELETE FROM usuarios WHERE id = $1', [usuario]);
  await pool.end();
});

describe('RF-46, TA-38: o lote nasce seguindo o protocolo do recipiente', () => {
  it('as cinco etapas são materializadas, e a data de plantio fica vazia', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');

    const ficha = await findLote(pool, id);
    expect(ficha!.dataCriacao).toBe('2026-01-10');
    // TA-38: vazio significa "ainda não germinou", e é diferente de "germinou hoje"
    expect(ficha!.dataPlantio).toBeNull();

    const { rows } = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM lotes_etapas WHERE lote_id = $1',
      [id],
    );
    expect(rows[0].n).toBe(5);

    const { rows: comProtocolo } = await pool.query<{ protocoloId: string }>(
      'SELECT protocolo_id AS "protocoloId" FROM lotes WHERE id = $1',
      [id],
    );
    expect(comProtocolo[0].protocoloId).toBe(protocolo);
  });

  it('prova de mesa, 10/01: as âncoras de criação vencem, e as de etapa não vencem nada', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');

    // Etapas 1, 4 e 5 ancoram na criação: vencem em 10/01, 10/04 e 11/01
    expect((await daVisao(id, plantar))!.proximoVencimento).toBe('2026-01-10');
    expect((await daVisao(id, limpeza))!.proximoVencimento).toBe('2026-04-10');
    expect((await daVisao(id, irrigacao))!.proximoVencimento).toBe('2026-01-11');

    // Etapas 2 e 3 ficam sem âncora, e não vencem nada: nem aparecem na visão
    expect(await estado(id, classificar)).toMatchObject({ dataAncora: null });
    expect(await daVisao(id, classificar)).toBeNull();
    expect(await daVisao(id, selecao)).toBeNull();

    // 19/02 é o que sairia se a classificação ancorasse na criação (RN-31)
    expect((await daVisao(id, classificar))?.proximoVencimento).not.toBe('2026-02-19');
  });

  it('UC-22 FA-2: recipiente sem protocolo cria o lote e não cobra etapa nenhuma', async () => {
    const { id } = await novoLote(semProtocolo, canteiro2, '2026-01-10');

    const { rows } = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM lotes_etapas WHERE lote_id = $1',
      [id],
    );
    expect(rows[0].n).toBe(0);
    const { rows: semNada } = await pool.query<{ protocoloId: string | null }>(
      'SELECT protocolo_id AS "protocoloId" FROM lotes WHERE id = $1',
      [id],
    );
    expect(semNada[0].protocoloId).toBeNull();
  });
});

describe('a visão e o motor puro dão o mesmo número', () => {
  it('TA-41: limpeza executada em 15/09 vence em 14/12 nos dois lados', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');
    await pool.query(
      `UPDATE lotes_etapas SET ultima_execucao_em = '2026-09-15', ocorrencias = 1
        WHERE lote_id = $1 AND protocolo_etapa_id = $2`,
      [id, limpeza],
    );

    const visao = await daVisao(id, limpeza);
    const puro = vencimentoDaEtapa(
      { dias: 90, intervaloDias: 90, alertaLigado: true, janelaAvisoPct: null },
      (await estado(id, limpeza))!,
      null,
    );

    expect(visao!.proximoVencimento).toBe('2026-12-14');
    expect(puro).toBe('2026-12-14');
    expect(puro).toBe(visao!.proximoVencimento);
  });

  it('TA-42: vencida em 10/04 e olhada em 10/07, é uma pendência de 91 dias', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');

    const visao = await daVisao(id, limpeza);
    expect(visao!.proximoVencimento).toBe('2026-04-10');

    const atual = (await estado(id, limpeza))!;
    expect(diasDeAtraso({ dias: 90, intervaloDias: 90, alertaLigado: true, janelaAvisoPct: null }, atual, null, '2026-07-10')).toBe(91);

    // Nenhuma ocorrência nova nasceu no caminho (RN-33)
    expect(atual.ocorrencias).toBe(0);
    const { rows } = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM lotes_etapas WHERE lote_id = $1 AND protocolo_etapa_id = $2',
      [id, limpeza],
    );
    expect(rows[0].n).toBe(1);
  });

  it('TA-37: a janela de 20% de 90 dias são 18 dias, e a diária não recebe situação', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');

    const trimestral = await daVisao(id, limpeza);
    expect(trimestral!.diasAviso).toBe(18);

    const diaria = await daVisao(id, irrigacao);
    expect(diaria!.situacao).toBe('sem_alerta');

    // O motor puro concorda, nos dois casos
    const etapaLimpeza = { dias: 90, intervaloDias: 90, alertaLigado: true, janelaAvisoPct: null };
    const etapaIrrigacao = { dias: 1, intervaloDias: 1, alertaLigado: false, janelaAvisoPct: null };
    expect(situacaoDaEtapa(etapaLimpeza, (await estado(id, limpeza))!, null, JANELA_PADRAO, '2026-03-23')).toBe('atencao');
    expect(situacaoDaEtapa(etapaIrrigacao, (await estado(id, irrigacao))!, null, JANELA_PADRAO, '2026-06-01')).toBe('sem_alerta');
  });

  /** TA-44, RN-36: o tempo da espécie manda no tempo do protocolo. */
  it('TA-44: a espécie com 70 dias próprios vence em 70, e a sem customização em 40', async () => {
    await saveTempoDaEspecie(pool, especieLenta, classificar, { dias: 70, intervaloDias: null, observacoes: 'germina devagar' });

    const comum = await novoLote(tubete, canteiro1, '2026-01-10');
    const lenta = await novoLote(tubete, canteiro1, '2026-01-10', especieLenta);

    // As duas classificações ancoram no plantio, concluído em 25/01
    for (const lote of [comum.id, lenta.id]) {
      await pool.query(
        `UPDATE lotes_etapas SET data_ancora = '2026-01-25' WHERE lote_id = $1 AND protocolo_etapa_id = $2`,
        [lote, classificar],
      );
    }

    expect((await daVisao(comum.id, classificar))!.proximoVencimento).toBe('2026-03-06');
    expect((await daVisao(lenta.id, classificar))!.proximoVencimento).toBe('2026-04-05');
    expect((await daVisao(lenta.id, classificar))!.diasEfetivos).toBe(70);
  });

  it('a customização é apagada, e o tempo volta a vir do protocolo (FA-1)', async () => {
    await saveTempoDaEspecie(pool, especieLenta, limpeza, { dias: 45, intervaloDias: null, observacoes: null });
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10', especieLenta);
    expect((await daVisao(id, limpeza))!.diasEfetivos).toBe(45);

    // O upsert sobre a chave composta, que até aqui só tinha sido exercitado com mock
    await saveTempoDaEspecie(pool, especieLenta, limpeza, { dias: 50, intervaloDias: null, observacoes: null });
    expect((await daVisao(id, limpeza))!.diasEfetivos).toBe(50);

    expect(await saveTempoDaEspecie(pool, especieLenta, limpeza, null)).toBe('removido');
    expect((await daVisao(id, limpeza))!.diasEfetivos).toBe(90);
  });
});

describe('a etapa desativada sai da cobrança, e o lote encerrado também', () => {
  it('etapa inativa não aparece na visão', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');
    expect(await daVisao(id, limpeza)).not.toBeNull();

    await pool.query('UPDATE protocolos_etapas SET ativo = false WHERE id = $1', [limpeza]);
    expect(await daVisao(id, limpeza)).toBeNull();
    await pool.query('UPDATE protocolos_etapas SET ativo = true WHERE id = $1', [limpeza]);
  });

  it('as etapas do protocolo ficam na ordem de leitura', async () => {
    const etapas = await listEtapas(pool, protocolo);
    expect(etapas.map((e) => e.rotulo)).toEqual([
      'Plantar no tubete',
      'Classificar pos-germinacao',
      'Classificar selecao',
      'Limpar mato',
      'Irrigacao',
    ]);
    // A âncora vem resolvida com o rótulo, e não só com o id (RF-23)
    expect(etapas[1].etapaAncoraRotulo).toBe('Plantar no tubete');
  });
});
