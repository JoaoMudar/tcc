import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarAtribuicoes } from '../agenda';
import { insertArea, insertCanteiro } from '../areas';
import { criarLote, findLote } from '../lotes';
import { horizonteProtocolo } from '../parametros';
import { diasDeAtraso, situacaoDaEtapa, vencimentoDaEtapa } from '../protocolo-motor';
import { insertEtapa, insertProtocolo, listEtapas, listSugestoes, saveTempoDaEspecie } from '../protocolos';
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
let pessoa: string;
let turnoManha: string;
let tipoComLote: string;

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
  turnoManha = turnoId;

  // O tipo da sugestão exige lote: é o que o protocolo sempre carrega (RF-47)
  const { rows: tipoRows } = await pool.query<{ id: string }>(
    `INSERT INTO tipos_tarefa (nome, categoria, exige_lote) VALUES ($1, 'manutencao', true) RETURNING id`,
    [`${prefixo} Limpar`],
  );
  tipoComLote = tipoRows[0].id;
  const tipoTarefaId = tipoComLote;

  // Quem executa: a sugestão aceita só vira tarefa com participante (RN-41)
  const { rows: pessoaRows } = await pool.query<{ id: string }>(
    "INSERT INTO cadastro.pessoas (tipo, nome) VALUES ('pf', $1) RETURNING id",
    [`${prefixo} Rogerio`],
  );
  pessoa = pessoaRows[0].id;
  await pool.query(
    "INSERT INTO cadastro.pessoas_papeis (pessoa_id, papel, tipo_vinculo, ativo) VALUES ($1, 'funcionario', 'fixo', true)",
    [pessoa],
  );

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
  // A atribuição aponta para a etapa e para o lote: sai antes dos dois
  await pool.query(`DELETE FROM atribuicoes WHERE lote_id IN (${lotes})`, [especie, especieLenta]);
  await pool.query('DELETE FROM semanas WHERE inicio_semana IN ($1, $2, $3)', ['2030-02-04', '2030-02-11', '2030-02-18']);
  await pool.query(`DELETE FROM lotes_etapas WHERE lote_id IN (${lotes})`, [especie, especieLenta]);
  await pool.query(`DELETE FROM movimentos_lote WHERE lote_id IN (${lotes})`, [especie, especieLenta]);
  await pool.query('DELETE FROM lotes WHERE especie_id IN ($1, $2)', [especie, especieLenta]);
  await pool.query('DELETE FROM especies_protocolos_tempos WHERE especie_id IN ($1, $2)', [especie, especieLenta]);
  await pool.query('DELETE FROM protocolos_etapas WHERE protocolo_id = $1', [protocolo]);
  await pool.query('DELETE FROM protocolos WHERE id = $1', [protocolo]);
  await pool.query('DELETE FROM especies WHERE id IN ($1, $2)', [especie, especieLenta]);
  await pool.query('DELETE FROM recipientes WHERE id IN ($1, $2)', [tubete, semProtocolo]);
  await pool.query("DELETE FROM areas WHERE letra = 'T'");
  await pool.query('DELETE FROM tipos_tarefa WHERE id = $1', [tipoComLote]);
  await pool.query('DELETE FROM cadastro.pessoas WHERE id = $1', [pessoa]);
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

/**
 * RF-47, TA-39. O protocolo **sugere**, e nada mais: enquanto ninguém aceitar,
 * não existe linha nenhuma em `atribuicoes`.
 */
describe('as sugestões ao lado da semana', () => {
  /** Aceita a sugestão como a tela faz: o mesmo lançamento de tarefa, com a etapa junto. */
  const aceitar = (loteId: string, loteEtapaId: string, semana = '2030-02-04') =>
    tx((client) =>
      criarAtribuicoes(client, {
        semana,
        dias: [semana],
        turnoId: turnoManha,
        tipoTarefaId: tipoComLote,
        horaInicio: null,
        horaFim: null,
        participantes: [pessoa],
        loteId,
        especieId: null,
        recipienteId: null,
        areaId: null,
        canteiroId: null,
        quantidadePlanejada: null,
        recorrente: false,
        observacoes: null,
        loteEtapaId,
      }),
    );

  it('as etapas vencidas ou a vencer aparecem, e o horizonte é parâmetro', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');

    // Em 10/01 vencem a etapa 1 (mesmo dia) e a 5 (dia seguinte); a limpeza só em 10/04
    const noDia = await listSugestoes(pool, '2026-01-10', await horizonteProtocolo(pool));
    const doLote = noDia.filter((s) => s.loteId === id);
    expect(doLote.map((s) => s.rotulo).sort()).toEqual(['Irrigacao', 'Plantar no tubete']);

    // A limpeza entra quando o horizonte a alcança
    const largo = await listSugestoes(pool, '2026-01-10', 120);
    expect(largo.filter((s) => s.loteId === id).map((s) => s.rotulo)).toContain('Limpar mato');

    // A etapa sem âncora resolvida não é sugerida, porque não vence nada
    expect(doLote.map((s) => s.rotulo)).not.toContain('Classificar pos-germinacao');
  });

  it('a sugestão traz o lote, o tipo e o turno da etapa, e o atraso que ela carrega', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');
    const sugestoes = await listSugestoes(pool, '2026-07-10', 14);
    const limpar = sugestoes.find((s) => s.loteId === id && s.rotulo === 'Limpar mato');

    expect(limpar).toBeDefined();
    expect(limpar!.tipoTarefaId).toBe(tipoComLote);
    expect(limpar!.turnoId).toBe(turnoManha);
    expect(limpar!.vencimento).toBe('2026-04-10');
    // TA-42: a mesma pendência, cada vez mais velha
    expect(limpar!.diasAtraso).toBe(91);
    expect(limpar!.situacao).toBe('atraso');
  });

  it('TA-39: a sugestão aceita deixa de ser sugerida, e nada existia na agenda antes disso', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');

    // Antes de aceitar: sugerida, e sem nenhuma linha em atribuicoes
    const antes = await listSugestoes(pool, '2026-07-10', 14);
    expect(antes.some((s) => s.loteId === id && s.rotulo === 'Limpar mato')).toBe(true);
    const { rows: vazio } = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM atribuicoes WHERE lote_id = $1',
      [id],
    );
    expect(vazio[0].n).toBe(0);

    await aceitar(id, limpeza);

    const depois = await listSugestoes(pool, '2026-07-10', 14);
    expect(depois.some((s) => s.loteId === id && s.rotulo === 'Limpar mato')).toBe(false);
  });

  it('o vencimento é congelado pelo servidor, e não pelo dia escolhido', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');
    await aceitar(id, limpeza);

    const { rows } = await pool.query<{ vencimento: string; data: string }>(
      `SELECT to_char(vencimento_protocolo, 'YYYY-MM-DD') AS vencimento,
              to_char(data_trabalho, 'YYYY-MM-DD') AS data
         FROM atribuicoes WHERE lote_id = $1 AND lote_etapa_id = $2`,
      [id, limpeza],
    );
    // A tarefa foi lançada para fevereiro de 2030, e o vencimento continua sendo 10/04/2026
    expect(rows[0].data).toBe('2030-02-04');
    expect(rows[0].vencimento).toBe('2026-04-10');
  });

  it('RN-33: aceitar duas vezes o mesmo vencimento é recusado pelo banco', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');
    await aceitar(id, limpeza);
    await expect(aceitar(id, limpeza, '2030-02-11')).rejects.toMatchObject({ code: '23505' });
  });

  it('a tarefa cancelada volta a ser sugerida: cancelar é o que permite lançar de novo', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');
    const daLimpeza = (lista: Awaited<ReturnType<typeof listSugestoes>>) =>
      lista.some((s) => s.loteId === id && s.rotulo === 'Limpar mato');

    await aceitar(id, limpeza);
    // Só a limpeza sai da lista: as outras etapas vencidas do mesmo lote continuam sendo sugeridas
    expect(daLimpeza(await listSugestoes(pool, '2026-07-10', 14))).toBe(false);

    await pool.query("UPDATE atribuicoes SET situacao = 'cancelada' WHERE lote_id = $1 AND lote_etapa_id = $2", [id, limpeza]);
    expect(daLimpeza(await listSugestoes(pool, '2026-07-10', 14))).toBe(true);
  });

  it('a etapa que não é daquele lote é recusada antes de a FK composta reclamar', async () => {
    // O lote do recipiente sem protocolo não tem linha nenhuma em `lotes_etapas`
    const outro = await novoLote(semProtocolo, canteiro2, '2026-01-10');
    await expect(aceitar(outro.id, limpeza, '2030-02-18')).rejects.toThrow(/não pertence ao lote/);
  });

  it('a etapa cuja âncora ainda não ocorreu não vence nada, e não vira tarefa', async () => {
    const { id } = await novoLote(tubete, canteiro1, '2026-01-10');
    // `classificar` ancora na conclusão do plantio, que não aconteceu: `data_ancora` é nula
    await expect(aceitar(id, classificar, '2030-02-18')).rejects.toThrow(/não vence nada/);
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
