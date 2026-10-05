// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Perfil } from '@/lib/permissions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('@/lib/auth/dal', () => ({ requireUser: vi.fn() }));

const client = { query: vi.fn(), release: vi.fn() };
vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn(async () => client) } }));

const { requireUser } = await import('@/lib/auth/dal');
const { default: pool } = await import('@/lib/db');
const { FORBIDDEN_MESSAGE } = await import('@/lib/auth/guards');
const actions = await import('../actions');

const ID = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const PESSOA = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e1f';
const SEMANA = '2026-09-14';

function loggedAs(perfil: Perfil) {
  vi.mocked(requireUser).mockResolvedValue({
    sessaoId: 's1',
    usuarioId: 'u1',
    login: 'x',
    nomeExibicao: 'X',
    perfil,
    deveTrocarSenha: false,
    expiraEm: new Date(),
    ultimoUsoEm: new Date(),
  });
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

function expectNoDatabase() {
  expect(pool.query).not.toHaveBeenCalled();
  expect(pool.connect).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockReset();
});

describe('permissões da agenda (D4 §3.3)', () => {
  it('chefia só lê: não lança, altera, exclui nem fecha', async () => {
    loggedAs('chefia');
    const semana = form({ semana: SEMANA });
    const tarefa = form({ id: ID });
    await expect(actions.criarAtribuicaoAction({}, form({}))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.atualizarAtribuicaoAction({}, tarefa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.excluirAtribuicaoAction({}, tarefa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.reagendarAtribuicaoAction({}, tarefa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.promoverAtribuicaoAction({}, tarefa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.fecharSemanaAction({}, semana)).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });

  it('gerência passa pelo guard, e o que é inválido volta antes do banco', async () => {
    loggedAs('gerencia');
    expect(await actions.criarAtribuicaoAction({}, form({ semana: '2026-09-15' }))).toMatchObject({ error: 'Semana inválida.' });
    expect(await actions.criarAtribuicaoAction({}, form({ semana: SEMANA, tipo_tarefa_id: 'x' }))).toMatchObject({
      error: 'Escolha o tipo de tarefa.',
    });
    expect(await actions.atualizarAtribuicaoAction({}, form({ id: 'x' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.excluirAtribuicaoAction({}, form({ id: 'x' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.reagendarAtribuicaoAction({}, form({ id: 'x' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.promoverAtribuicaoAction({}, form({ id: 'x' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.reagendarAtribuicaoAction({}, form({ id: ID, data: '2026-13-40' }))).toEqual({ error: 'Dia inválido.' });
    expect(await actions.reagendarAtribuicaoAction({}, form({ id: ID, data: SEMANA, turno_id: 'x' }))).toMatchObject({
      error: expect.stringContaining('Escolha o turno'),
    });
    expect(await actions.fecharSemanaAction({}, form({ semana: 'x' }))).toEqual({ error: 'Semana inválida.' });
    expectNoDatabase();
  });

  it('fechar a semana aberta, sem publicar antes, volta para a agenda', async () => {
    loggedAs('gerencia');
    client.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM semanas')
        ? { rows: [{ id: 's1', inicio: SEMANA, situacao: 'aberta', fechadaEm: null }] }
        : { rows: [], rowCount: 2 },
    );
    await expect(actions.fecharSemanaAction({}, form({ semana: SEMANA }))).rejects.toThrow(
      `redirect:/producao?dia=${SEMANA}&feito=fechada`,
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('arrastar em semana fechada recusa, e nada é gravado', async () => {
    loggedAs('gerencia');
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM atribuicoes WHERE id')) return { rows: [{ semanaId: 's1' }] };
      if (sql.includes('FROM semanas')) return { rows: [{ id: 's1', inicio: SEMANA, situacao: 'fechada', fechadaEm: new Date() }] };
      if (sql.includes('FOR UPDATE OF a')) return { rows: [{ id: ID, situacao: 'planejada', loteId: null, exigeLote: false }] };
      return { rows: [] };
    });
    const state = await actions.reagendarAtribuicaoAction(
      {},
      form({ id: ID, data: SEMANA, turno_id: PESSOA, hora_inicio: '07:00', hora_fim: '08:00' }),
    );
    expect(state).toEqual({ error: expect.stringContaining('está fechada e não se altera') });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE atribuicoes SET data_trabalho'), expect.anything());
  });

  it('RF-26: trazer para cima grava a precedência, e a semana fechada recusa', async () => {
    loggedAs('gerencia');
    let situacao = 'aberta';
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM atribuicoes WHERE id')) return { rows: [{ semanaId: 's1' }] };
      if (sql.includes('FROM semanas')) return { rows: [{ id: 's1', inicio: SEMANA, situacao, fechadaEm: null }] };
      if (sql.includes('FOR UPDATE OF a')) return { rows: [{ id: ID, situacao: 'confirmada' }] };
      return { rows: [] };
    });
    expect(await actions.promoverAtribuicaoAction({}, form({ id: ID }))).toEqual({ success: 'Tarefa em destaque.' });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('SET prioridade_em'), [ID]);

    client.query.mockClear();
    situacao = 'fechada';
    expect(await actions.promoverAtribuicaoAction({}, form({ id: ID }))).toEqual({ error: expect.stringContaining('está fechada') });
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('SET prioridade_em'), expect.anything());
  });

  it('RN-61: o arrasto entre linhas leva quem sai e quem entra; sair sem entrar é recusado antes do banco', async () => {
    loggedAs('gerencia');
    expect(
      await actions.reagendarAtribuicaoAction({}, form({ id: ID, data: SEMANA, turno_id: PESSOA, hora_inicio: '', hora_fim: '', sai: PESSOA })),
    ).toEqual({ error: expect.stringContaining('linha de uma pessoa') });
    expectNoDatabase();
  });

  it('as ações de abrir, publicar e copiar a semana não existem mais', () => {
    expect(actions).not.toHaveProperty('abrirSemanaAction');
    expect(actions).not.toHaveProperty('publicarSemanaAction');
    expect(actions).not.toHaveProperty('copiarSemanaAction');
  });
});

describe('RF-66: postergar e confirmar o que pede providência', () => {
  const LOTE = '2d9f4e5a-0b7c-4e3d-9f2a-4b8c9d0e1f2a';
  const ETAPA = '3e0a5f6b-1c8d-4f4e-8a3b-5c9d0e1f2a3b';

  const TIPO = '4f1b6a7c-2d9e-4a5f-9b4c-6d0e1f2a3b4c';
  const TURNO = '5a2c7b8d-3e0f-4b6a-8c5d-7e1f2a3b4c5d';

  function feita(extra: Record<string, string> = {}): FormData {
    return form({ lote_etapa_id: ETAPA, lote_id: LOTE, tipo_tarefa_id: TIPO, dias: '2026-09-15', turno_id: TURNO, participantes: PESSOA, ...extra });
  }

  it('chefia só lê: não posterga nem confirma', async () => {
    loggedAs('chefia');
    const etapa = form({ lote_id: LOTE, etapa_id: ETAPA, dias: '7' });
    await expect(actions.adiarEtapaAction({}, etapa)).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.registrarTarefaFeitaAction({}, feita())).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(actions.adiarAtribuicaoAction({}, form({ id: ID, dias: '7' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });

  it('o que é inválido volta antes do banco', async () => {
    loggedAs('gerencia');
    expect(await actions.adiarEtapaAction({}, form({ lote_id: 'x', etapa_id: ETAPA, dias: '7' }))).toEqual({ error: 'Etapa inválida.' });
    expect(await actions.adiarEtapaAction({}, form({ lote_id: LOTE, etapa_id: ETAPA, dias: '0' }))).toEqual({ error: 'Informe de 1 a 90 dias.' });
    expect(await actions.registrarTarefaFeitaAction({}, feita({ dias: '' }))).toMatchObject({ error: 'Escolha o dia em que a tarefa foi feita.' });
    expect(await actions.registrarTarefaFeitaAction({}, feita({ dias: '2999-01-01' }))).toMatchObject({
      error: 'O dia em que foi feita não pode estar no futuro.',
    });
    expect(await actions.registrarTarefaFeitaAction({}, feita({ tipo_tarefa_id: 'x' }))).toMatchObject({ error: 'Tipo de tarefa inválido.' });
    expect(await actions.adiarAtribuicaoAction({}, form({ id: 'x', dias: '7' }))).toEqual({ error: 'Tarefa inválida.' });
    expect(await actions.adiarAtribuicaoAction({}, form({ id: ID, dias: '120' }))).toEqual({ error: 'Informe de 1 a 90 dias.' });
    expectNoDatabase();
  });

  it('postergar grava a ação na ocorrência que está por vir, com o autor', async () => {
    loggedAs('gerencia');
    client.query.mockImplementation(async (sql: string) =>
      sql.includes('FOR UPDATE OF le') ? { rows: [{ ocorrencia: 3, vencimento: '2999-01-10' }] } : { rows: [] },
    );
    expect(await actions.adiarEtapaAction({}, form({ lote_id: LOTE, etapa_id: ETAPA, dias: '7' }))).toEqual({ success: 'Adiada para 17/01/2999.' });
    const insert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO lotes_etapas_acoes'));
    expect(insert?.[1]).toEqual([LOTE, ETAPA, 3, 7, 'u1']);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('postergar a etapa vencida conta de hoje, e a linha leva o atraso junto', async () => {
    loggedAs('gerencia');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T12:00:00-03:00'));
    try {
      client.query.mockImplementation(async (sql: string) =>
        sql.includes('FOR UPDATE OF le') ? { rows: [{ ocorrencia: 1, vencimento: '2026-10-01' }] } : { rows: [] },
      );
      expect(await actions.adiarEtapaAction({}, form({ lote_id: LOTE, etapa_id: ETAPA, dias: '1' }))).toEqual({ success: 'Adiada para 06/10/2026.' });
      const insert = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO lotes_etapas_acoes'));
      // De 01/10 a 06/10: os quatro dias de atraso mais o um pedido
      expect(insert?.[1]).toEqual([LOTE, ETAPA, 1, 5, 'u1']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a confirmação sem ninguém que fez volta sem gravar, com o que foi digitado', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: TIPO, nome: 'Limpeza', eQuantitativa: false, exigeLote: true, exigeEspecie: false, exigeRecipiente: false, exigeArea: false, unidadeMedida: 'un', ativo: true }],
    } as never);
    expect(await actions.registrarTarefaFeitaAction({}, feita({ participantes: '', perdidas: '3' }))).toMatchObject({
      error: 'Escolha ao menos uma pessoa.',
      fields: { perdidas: '3', dias: '2026-09-15' },
    });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('a perda sem causa volta antes de lançar a tarefa', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: TIPO, nome: 'Limpeza', eQuantitativa: false, exigeLote: true, exigeEspecie: false, exigeRecipiente: false, exigeArea: false, unidadeMedida: 'un', ativo: true }],
    } as never);
    expect(await actions.registrarTarefaFeitaAction({}, feita({ perdidas: '3' }))).toMatchObject({ error: 'Escolha a causa das mudas que morreram.' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('a ação de concluir sem agenda não existe mais: confirmar registra a tarefa', () => {
    expect(actions).not.toHaveProperty('concluirEtapaSemAgendaAction');
  });
});
