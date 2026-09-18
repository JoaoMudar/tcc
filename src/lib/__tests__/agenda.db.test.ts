import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type AtribuicaoInput,
  type ConfirmacaoInput,
  type ReagendamentoInput,
  abrirSemana,
  atualizarAtribuicao,
  conferirAtribuicaoDaRepicagem,
  confirmarAtribuicao,
  copiarSemanaAnterior,
  criarAtribuicoes,
  excluirAtribuicao,
  fecharSemana,
  findAtribuicao,
  findSemana,
  listAgendaDia,
  listAgendaSemana,
  listFuncionarios,
  publicarSemana,
  reagendarAtribuicao,
  resumoFechamento,
} from '../agenda';
import { insertArea, insertCanteiro } from '../areas';
import { criarLote, findLote, listMovimentos, repicarLote, saldoDosMovimentos } from '../lotes';
import { insertRecipiente } from '../recipientes';
import { withTransaction } from '../transaction';

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const prefixo = `ta${randomUUID().slice(0, 6)}`;
// Semanas longe de qualquer outra suíte: segunda-feira, 2030
const S1 = '2030-01-07';
const S2 = '2030-01-14';
// Segunda-feira cuja semana anterior ninguém usa
const S3 = '2031-01-06';
// Semana isolada do reagendamento: nenhuma outra contagem passa por ela
const S4 = '2031-02-03';

let usuario: string;
let manha: string;
let tarde: string;
let rogerio: string;
let amelia: string;
let jaison: string;
let valdir: string;
let cleusa: string;
let encher: string;
let irrigar: string;
let repicar: string;
let areaV: string;
let canteiro1: string;
let canteiro2: string;
let especie: string;
let tubete: string;
let saco: string;
let lote: string;

/** Ids guardados de um teste para o seguinte: os `it` rodam em ordem. */
const ids: Record<string, string> = {};

const tx = <T>(fn: (client: PoolClient) => Promise<T>) => withTransaction(pool, fn);

async function funcionario(nome: string, ativo = true): Promise<string> {
  const { rows } = await pool.query<{ id: string }>("INSERT INTO cadastro.pessoas (tipo, nome) VALUES ('pf', $1) RETURNING id", [
    `${prefixo} ${nome}`,
  ]);
  await pool.query("INSERT INTO cadastro.pessoas_papeis (pessoa_id, papel, tipo_vinculo, ativo) VALUES ($1, 'funcionario', 'fixo', $2)", [
    rows[0].id,
    ativo,
  ]);
  return rows[0].id;
}

async function tipo(nome: string, declara: { q?: boolean; lote?: boolean; recipiente?: boolean }): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO tipos_tarefa (nome, categoria, e_quantitativa, exige_lote, exige_recipiente)
     VALUES ($1, 'manutencao', $2, $3, $4) RETURNING id`,
    [`${prefixo} ${nome}`, declara.q ?? false, declara.lote ?? false, declara.recipiente ?? false],
  );
  return rows[0].id;
}

function tarefa(over: Partial<AtribuicaoInput> = {}): AtribuicaoInput {
  return {
    semana: S1,
    dias: [S1],
    turnoId: manha,
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
    ...over,
  };
}

const criar = (over: Partial<AtribuicaoInput> = {}) => tx((client) => criarAtribuicoes(client, tarefa(over)));

const confirmar = (id: string, over: Partial<ConfirmacaoInput> = {}) =>
  tx((client) =>
    confirmarAtribuicao(client, id, { loteId: null, areaId: null, canteiroId: null, quantidades: [], perda: null, ...over }, usuario),
  );

async function situacao(id: string) {
  return (await findAtribuicao(pool, id))?.situacao;
}

beforeAll(async () => {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (login, nome_exibicao, senha_hash, perfil, deve_trocar_senha)
     VALUES ($1, 'Gerência de teste', 'x', 'gerencia', false) RETURNING id`,
    [prefixo],
  );
  usuario = rows[0].id;
  const turnos = await pool.query<{ id: string; nome: string }>("SELECT id, nome FROM turnos_trabalho WHERE nome IN ('manha', 'tarde')");
  manha = turnos.rows.find((t) => t.nome === 'manha')!.id;
  tarde = turnos.rows.find((t) => t.nome === 'tarde')!.id;

  [rogerio, amelia, jaison, valdir] = [await funcionario('Rogério'), await funcionario('Amélia'), await funcionario('Jaison'), await funcionario('Valdir')];
  cleusa = await funcionario('Cleusa', false);
  encher = await tipo('Encher saquinho', { q: true, recipiente: true });
  irrigar = await tipo('Irrigação', {});
  repicar = await tipo('Repicagem', { q: true, lote: true });

  areaV = await insertArea(pool, { letra: 'V', nome: null });
  canteiro1 = (await insertCanteiro(pool, { areaId: areaV, numero: 1, capacidade: null }))!;
  canteiro2 = (await insertCanteiro(pool, { areaId: areaV, numero: 2, capacidade: null }))!;
  ({
    rows: [{ id: especie }],
  } = await pool.query<{ id: string }>('INSERT INTO especies (nome_cientifico) VALUES ($1) RETURNING id', [`${prefixo} Handroanthus`]));
  tubete = await insertRecipiente(pool, { nome: `${prefixo} tubete`, volumeLitros: 0.055 });
  saco = await insertRecipiente(pool, { nome: `${prefixo} saco`, volumeLitros: 0.9 });
  ({ id: lote } = await tx((client) =>
    criarLote(client, {
      especieId: especie,
      recipienteId: tubete,
      canteiroId: canteiro1,
      quantidade: 1000,
      dataPlantio: '2029-12-01',
      observacoes: null,
      registradoPor: usuario,
    }),
  ));
});

afterAll(async () => {
  await pool.end();
});

describe('agenda da semana contra Postgres', () => {
  it('TA-10: o funcionário sem usuário entra na escalação, e o inativo não', async () => {
    const nomes = (await listFuncionarios(pool)).map((f) => f.id);
    expect(nomes).toContain(rogerio);
    expect(nomes).not.toContain(cleusa);
  });

  it('TA-26: duas tarefas no mesmo turno, cada uma com o seu grupo, e a semana nasce em rascunho', async () => {
    [ids.encher] = await criar({ tipoTarefaId: encher, participantes: [rogerio, amelia], recipienteId: tubete, quantidadePlanejada: 500 });
    [ids.irrigar] = await criar({ tipoTarefaId: irrigar, participantes: [jaison] });

    const doDia = (await listAgendaDia(pool, S1)).filter((a) => a.id === ids.encher || a.id === ids.irrigar);
    expect(doDia).toHaveLength(2);
    expect(doDia.every((a) => a.turnoId === manha)).toBe(true);
    expect(doDia.find((a) => a.id === ids.encher)!.participantes.map((p) => p.id).sort()).toEqual([rogerio, amelia].sort());
    expect(doDia.find((a) => a.id === ids.irrigar)!.participantes.map((p) => p.id)).toEqual([jaison]);
    expect(await findSemana(pool, S1)).toMatchObject({ situacao: 'rascunho', fechadaEm: null });
  });

  it('TA-27: a tarefa com hora a guarda, a sem hora é aceita, e as duas têm turno; vários dias de uma vez', async () => {
    const recorrentes = await criar({ participantes: [jaison], horaInicio: '07:00', horaFim: '08:00', recorrente: true, dias: [S1, '2030-01-08'] });
    expect(recorrentes).toHaveLength(2);
    ids.recorrente = recorrentes[0];
    expect(await findAtribuicao(pool, ids.recorrente)).toMatchObject({ turnoId: manha, horaInicio: '07:00', horaFim: '08:00', eRecorrente: true });
    expect(await findAtribuicao(pool, ids.encher)).toMatchObject({ turnoId: manha, horaInicio: null, horaFim: null });
  });

  it('TA-68: arrastar remarca dia, turno e hora, e recusa o que sai da semana ou já aconteceu', async () => {
    // Semana só deste caso: acrescentar tarefa a S1 mudaria a contagem da cópia em TA-29
    const [id] = await criar({ semana: S4, dias: [S4], participantes: [valdir] });
    const reagendar = (over: Partial<ReagendamentoInput> = {}) =>
      tx((client) =>
        reagendarAtribuicao(client, id, { data: '2031-02-05', turnoId: tarde, horaInicio: '13:30', horaFim: '15:00', ...over }),
      );

    await reagendar();
    expect(await findAtribuicao(pool, id)).toMatchObject({
      data: '2031-02-05',
      turnoId: tarde,
      horaInicio: '13:30',
      horaFim: '15:00',
    });

    // O arrasto não atravessa a semana, e o CHECK do banco é a segunda barreira do horário
    await expect(reagendar({ data: '2031-02-10' })).rejects.toThrow('desta semana');
    await expect(reagendar({ horaInicio: '15:00', horaFim: '14:00' })).rejects.toThrow();

    // O que já aconteceu não se remaneja
    await confirmar(id);
    await expect(reagendar()).rejects.toThrow('não se altera');
  });

  it('TA-28: o banco é a segunda barreira contra fim sem início', async () => {
    await expect(pool.query("UPDATE atribuicoes SET hora_inicio = NULL, hora_fim = '08:00' WHERE id = $1", [ids.recorrente])).rejects.toThrow();
  });

  it('o servidor confere pessoa, lote e canteiro, e não só o formulário', async () => {
    await expect(criar({ participantes: [cleusa] })).rejects.toThrow('não é funcionário em atividade');
    const outra = await insertArea(pool, { letra: 'U', nome: null });
    await expect(criar({ areaId: outra, canteiroId: canteiro2 })).rejects.toThrow('não é dessa área');
  });

  it('TA-31: a quantitativa com três participantes confirma cada um com o seu número', async () => {
    [ids.tres] = await criar({ tipoTarefaId: encher, participantes: [rogerio, amelia, jaison], dias: ['2030-01-08'] });
    await confirmar(ids.tres, {
      quantidades: [
        { pessoaId: rogerio, quantidade: 100 },
        { pessoaId: amelia, quantidade: 120 },
        { pessoaId: jaison, quantidade: null },
      ],
    });
    const confirmada = await findAtribuicao(pool, ids.tres);
    expect(confirmada!.situacao).toBe('confirmada');
    expect(Object.fromEntries(confirmada!.participantes.map((p) => [p.id, p.quantidade]))).toEqual({
      [rogerio]: 100,
      [amelia]: 120,
      [jaison]: null,
    });
  });

  it('TA-32: a tarefa que declara lote é recusada sem ele, e continua planejada', async () => {
    [ids.repicar] = await criar({ tipoTarefaId: repicar, participantes: [rogerio], dias: ['2030-01-09'] });
    await expect(confirmar(ids.repicar)).rejects.toThrow('exige o lote');
    expect(await situacao(ids.repicar)).toBe('planejada');
  });

  it('TA-33: a tarefa sem lote registra a área, sem canteiro', async () => {
    await confirmar(ids.irrigar, { areaId: areaV });
    expect(await findAtribuicao(pool, ids.irrigar)).toMatchObject({ situacao: 'confirmada', area: 'V', canteiroId: null });
  });

  it('confirmar com mudas mortas grava a perda no lote, ligada à tarefa, e a soma fecha com o saldo', async () => {
    const { perda } = await confirmar(ids.repicar, {
      loteId: lote,
      quantidades: [{ pessoaId: rogerio, quantidade: 200 }],
      perda: { quantidade: 30, causa: 'seca' },
    });
    expect(perda).toEqual({ saldo: 970, encerrado: false });
    const { rows } = await pool.query('SELECT tipo_movimento, quantidade, causa_perda FROM movimentos_lote WHERE atribuicao_id = $1', [
      ids.repicar,
    ]);
    expect(rows).toEqual([{ tipo_movimento: 'perda', quantidade: -30, causa_perda: 'seca' }]);
    const ficha = await findLote(pool, lote);
    expect(saldoDosMovimentos(await listMovimentos(pool, lote))).toBe(ficha!.quantidadeAtual);
  });

  it('UC-20 FA-1: a repicagem só se liga à tarefa confirmada daquele lote, e os movimentos apontam para ela', async () => {
    await expect(tx((client) => conferirAtribuicaoDaRepicagem(client, ids.encher, lote))).rejects.toThrow('ainda não foi confirmada');
    const { rows: outro } = await pool.query<{ id: string }>('SELECT id FROM lotes WHERE id <> $1 LIMIT 1', [lote]);
    if (outro[0]) await expect(tx((client) => conferirAtribuicaoDaRepicagem(client, ids.repicar, outro[0].id))).rejects.toThrow('não é deste lote');

    const novo = await tx(async (client) => {
      await conferirAtribuicaoDaRepicagem(client, ids.repicar, lote);
      return repicarLote(client, {
        origemId: lote,
        quantidade: 400,
        perdidas: 10,
        causa: 'manuseio',
        recipienteId: saco,
        canteiroId: canteiro2,
        observacoes: null,
        registradoPor: usuario,
        atribuicaoId: ids.repicar,
      });
    });
    const { rows } = await pool.query<{ tipo_movimento: string }>(
      'SELECT tipo_movimento FROM movimentos_lote WHERE atribuicao_id = $1 ORDER BY criado_em',
      [ids.repicar],
    );
    expect(rows.map((r) => r.tipo_movimento).sort()).toEqual(['perda', 'perda', 'repicagem_entrada', 'repicagem_saida']);
    for (const id of [lote, novo.id]) {
      const ficha = await findLote(pool, id);
      expect(saldoDosMovimentos(await listMovimentos(pool, id))).toBe(ficha!.quantidadeAtual);
    }
    expect(novo.saldoOrigem).toBe(560);
  });

  it('só a tarefa planejada se altera ou se exclui', async () => {
    await expect(tx((client) => atualizarAtribuicao(client, ids.tres, tarefa({ dias: ['2030-01-08'] })))).rejects.toThrow('já está confirmada');
    await expect(tx((client) => excluirAtribuicao(client, ids.tres))).rejects.toThrow('já está confirmada');

    const [id] = await criar({ participantes: [amelia], dias: ['2030-01-10'] });
    await tx((client) => atualizarAtribuicao(client, id, tarefa({ participantes: [jaison], dias: ['2030-01-11'], turnoId: tarde })));
    expect(await findAtribuicao(pool, id)).toMatchObject({ data: '2030-01-11', turnoId: tarde, participantes: [expect.objectContaining({ id: jaison })] });
    await expect(tx((client) => atualizarAtribuicao(client, id, tarefa({ semana: S2, dias: [S2] })))).rejects.toThrow('mesma semana');

    expect(await tx((client) => excluirAtribuicao(client, id))).toEqual({ semanaInicio: S1 });
    expect(await findAtribuicao(pool, id)).toBeNull();
  });

  it('TA-29: a semana nova nasce com as recorrentes, e a cópia traz o resto uma vez só', async () => {
    // Tarefa de quem deixou de ser funcionário não vai para a semana nova
    await criar({ participantes: [valdir], dias: ['2030-01-10'] });
    await pool.query("UPDATE cadastro.pessoas_papeis SET ativo = false WHERE pessoa_id = $1 AND papel = 'funcionario'", [valdir]);

    const aberta = await tx((client) => abrirSemana(client, S2));
    expect(aberta).toMatchObject({ criada: true, recorrentes: 2 });
    const recorrentes = await listAgendaSemana(pool, aberta.id);
    expect(recorrentes.map((a) => [a.data, a.horaInicio, a.eRecorrente, a.situacao])).toEqual([
      [S2, '07:00', true, 'planejada'],
      ['2030-01-15', '07:00', true, 'planejada'],
    ]);
    expect(await tx((client) => abrirSemana(client, S2))).toMatchObject({ criada: false, recorrentes: 0 });

    const { rows } = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM atribuicoes a JOIN semanas s ON s.id = a.semana_id
        WHERE s.inicio_semana = $1 AND NOT a.e_recorrente`,
      [S1],
    );
    const { copiadas } = await tx((client) => copiarSemanaAnterior(client, S2));
    expect(copiadas).toBe(rows[0].n - 1);

    const semana = await listAgendaSemana(pool, aberta.id);
    expect(semana.every((a) => a.situacao === 'planejada')).toBe(true);
    expect(semana.flatMap((a) => a.participantes).every((p) => p.quantidade === null)).toBe(true);
    expect(semana.flatMap((a) => a.participantes.map((p) => p.id))).not.toContain(valdir);
    expect(semana.find((a) => a.tipoTarefaId === repicar)).toMatchObject({ loteId: lote, data: '2030-01-16' });

    await expect(tx((client) => copiarSemanaAnterior(client, S2))).rejects.toThrow('já tem tarefas lançadas');
  });

  it('TA-34 e TA-30: fechar marca a não confirmada, deixa a sem ninguém pendente, e a semana fechada não se altera', async () => {
    // A ordem sem ninguém escalado, como a que o protocolo vai gerar
    const semana = (await findSemana(pool, S1))!;
    const {
      rows: [orfa],
    } = await pool.query<{ id: string }>(
      'INSERT INTO atribuicoes (semana_id, data_trabalho, turno_id, tipo_tarefa_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [semana.id, '2030-01-11', tarde, irrigar],
    );

    await expect(tx((client) => fecharSemana(client, S1))).rejects.toThrow('Publique a semana');
    await tx((client) => publicarSemana(client, S1, usuario));
    await expect(tx((client) => publicarSemana(client, S1, usuario))).rejects.toThrow('já está publicada');

    const antes = await resumoFechamento(pool, semana.id);
    expect(antes.semConfirmacao).toBeGreaterThan(0);
    expect(antes.semNinguem).toBe(1);
    const { naoConfirmadas } = await tx((client) => fecharSemana(client, S1));
    expect(naoConfirmadas).toBe(antes.semConfirmacao);

    expect(await situacao(ids.encher)).toBe('nao_confirmada');
    expect(await situacao(ids.tres)).toBe('confirmada');
    expect(await situacao(orfa.id)).toBe('planejada');
    expect(await findSemana(pool, S1)).toMatchObject({ situacao: 'fechada', fechadaEm: expect.any(Date) });

    await expect(criar()).rejects.toThrow('está fechada e não se altera');
    await expect(confirmar(orfa.id)).rejects.toThrow('está fechada');
    await expect(tx((client) => excluirAtribuicao(client, orfa.id))).rejects.toThrow('está fechada');
    await expect(tx((client) => copiarSemanaAnterior(client, S1))).rejects.toThrow('está fechada');
    await expect(tx((client) => fecharSemana(client, S1))).rejects.toThrow('já está fechada');
  });

  it('sem nada na semana passada, não há o que copiar, e a semana não fica criada', async () => {
    await expect(tx((client) => copiarSemanaAnterior(client, S3))).rejects.toThrow('não tem tarefa para copiar');
    expect(await findSemana(pool, S3)).toBeNull();
  });
});
