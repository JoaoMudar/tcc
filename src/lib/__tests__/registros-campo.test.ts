// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/auth/session-store';
import type { Perfil } from '@/lib/permissions';

const client = { query: vi.fn(), release: vi.fn() };
vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn(async () => client) } }));
// A confirmação em si tem teste contra Postgres (agenda.db.test.ts); aqui interessa o que a cerca
vi.mock(import('../agenda'), async (original) => ({
  ...(await original()),
  confirmarAtribuicao: vi.fn(async () => ({ loteId: null, perda: null })),
}));

const { default: pool } = await import('@/lib/db');
const { processarRegistro } = await import('../registros-campo');

const CHAVE = '9d0e2f6a-7b8c-4d1a-8e0f-3a7b8c9d0e1f';
const LOTE = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const OUTRO = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e1f';
const TAREFA = '2d9f3e5a-0b7c-4e3d-9f2a-4b8c9d0e1f2a';
const PESSOA = '3e0a4f6b-1c8d-4f4e-8a3b-5c9d0e1f2a3b';

function usuario(perfil: Perfil): SessionUser {
  return {
    sessaoId: 's1',
    usuarioId: 'u1',
    login: 'x',
    nomeExibicao: 'X',
    perfil,
    deveTrocarSenha: false,
    expiraEm: new Date(),
    ultimoUsoEm: new Date(),
  };
}

/** Lote aberto com 200 mudas e chave nunca vista, respondidos pela forma do SQL. */
function bancoCom({ quantidadeAtual = 200, chaveJaVista = false } = {}) {
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes('INSERT INTO envios_recebidos')) return { rows: chaveJaVista ? [] : [{ chave: CHAVE }] };
    if (sql.includes('FROM envios_recebidos')) {
      return { rows: [{ tipo: 'perda', usuarioId: 'u1', resposta: { success: 'Perda de 50 por geada registrada.' } }] };
    }
    if (sql.includes('FROM lotes') && sql.includes('FOR UPDATE')) {
      return {
        rows: [{ id: LOTE, codigo: '2026-0001', especieId: 'e', recipienteId: 'r', canteiroId: OUTRO, quantidadeAtual, encerrado: false }],
      };
    }
    return { rows: [], rowCount: 1 };
  });
}

function inserts(tabela: string) {
  return client.query.mock.calls.filter(([sql]) => String(sql).includes(`INSERT INTO ${tabela}`));
}

function expectNoDatabase() {
  expect(pool.query).not.toHaveBeenCalled();
  expect(pool.connect).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockReset();
});

describe('permissões (D4 §3.5), as mesmas das Server Actions que a fila substituiu', () => {
  it('chefia só lê: não registra perda, contagem nem confirmação', async () => {
    const chefia = usuario('chefia');
    expect(await processarRegistro('perda', CHAVE, { lote_id: LOTE, quantidade: '5', causa: 'seca' }, chefia)).toEqual({ status: 'proibido' });
    expect(await processarRegistro('contagem', CHAVE, { lote_id: LOTE, contado: '5' }, chefia)).toEqual({ status: 'proibido' });
    expect(await processarRegistro('confirmacao_tarefa', CHAVE, { id: TAREFA }, chefia)).toEqual({ status: 'proibido' });
    expectNoDatabase();
  });

  it('admin tem acesso irrestrito (D4 §1.1)', async () => {
    bancoCom();
    const resultado = await processarRegistro('perda', CHAVE, { lote_id: LOTE, quantidade: '5', causa: 'seca' }, usuario('admin'));
    expect(resultado).toMatchObject({ status: 'gravado', success: expect.stringContaining('Perda de 5') });
  });
});

describe('perda (T4.5)', () => {
  it('quantidade inválida e causa fora da lista são recusadas sem ir ao banco', async () => {
    const gerencia = usuario('gerencia');
    expect(await processarRegistro('perda', CHAVE, { lote_id: LOTE, quantidade: '0', causa: 'seca' }, gerencia)).toMatchObject({
      status: 'recusado',
      error: expect.stringMatching(/maior que zero/),
    });
    expect(await processarRegistro('perda', CHAVE, { lote_id: LOTE, quantidade: '5', causa: 'fungo' }, gerencia)).toMatchObject({
      error: 'Escolha a causa da perda.',
    });
    expect(await processarRegistro('perda', CHAVE, { lote_id: 'x', quantidade: '5', causa: 'seca' }, gerencia)).toEqual({
      status: 'recusado',
      error: 'Lote inválido.',
    });
    expectNoDatabase();
  });

  it('grava com o autor da sessão, a chave na mesma transação, e diz o saldo que ficou', async () => {
    bancoCom();
    const resultado = await processarRegistro(
      'perda',
      CHAVE,
      { lote_id: LOTE, quantidade: '50', causa: 'geada', observacoes: '' },
      usuario('gerencia'),
    );
    expect(resultado).toEqual({
      status: 'gravado',
      success: 'Perda de 50 por geada registrada. O lote fica com 150 mudas.',
      repetido: false,
    });
    expect(inserts('movimentos_lote')[0]?.[1]).toEqual([LOTE, 'perda', -50, expect.any(String), 'geada', null, 'u1', null]);
    expect(inserts('envios_recebidos')[0]?.[1]).toEqual([CHAVE, 'perda', 'u1']);
    const guardada = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE envios_recebidos'));
    expect(JSON.parse(String(guardada?.[1]?.[1]))).toEqual({ success: 'Perda de 50 por geada registrada. O lote fica com 150 mudas.' });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('UC-20 FA-3: a chave já vista devolve a resposta da primeira vez e não baixa de novo', async () => {
    bancoCom({ chaveJaVista: true });
    const resultado = await processarRegistro('perda', CHAVE, { lote_id: LOTE, quantidade: '50', causa: 'geada' }, usuario('gerencia'));
    expect(resultado).toEqual({ status: 'gravado', success: 'Perda de 50 por geada registrada.', repetido: true });
    expect(inserts('movimentos_lote')).toHaveLength(0);
  });

  it('TA-20: perda maior que o saldo volta recusada, com rollback e os campos digitados', async () => {
    bancoCom();
    const resultado = await processarRegistro('perda', CHAVE, { lote_id: LOTE, quantidade: '250', causa: 'praga' }, usuario('gerencia'));
    expect(resultado).toMatchObject({ status: 'recusado', error: expect.stringContaining('tem 200 mudas'), fields: { quantidade: '250' } });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('falha que não é de regra é relançada, para a fila tentar de novo', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      throw Object.assign(new Error('conexão caiu'), { code: '08006' });
    });
    await expect(
      processarRegistro('perda', CHAVE, { lote_id: LOTE, quantidade: '5', causa: 'seca' }, usuario('gerencia')),
    ).rejects.toThrow('conexão caiu');
  });
});

describe('contagem (T4.6)', () => {
  it('sem diferença não grava movimento, mas guarda a chave', async () => {
    bancoCom();
    const resultado = await processarRegistro('contagem', CHAVE, { lote_id: LOTE, contado: '200' }, usuario('gerencia'));
    expect(resultado).toMatchObject({ status: 'gravado', success: 'A contagem bate com o saldo. Nada a ajustar.' });
    expect(inserts('movimentos_lote')).toHaveLength(0);
    expect(inserts('envios_recebidos')).toHaveLength(1);
  });

  it('com diferença grava o ajuste com sinal, calculado contra o saldo da hora em que chega', async () => {
    bancoCom({ quantidadeAtual: 190 });
    const resultado = await processarRegistro('contagem', CHAVE, { lote_id: LOTE, contado: '185' }, usuario('gerencia'));
    expect(resultado).toMatchObject({ success: 'Contagem registrada: 5 a menos que o calculado. O lote fica com 185 mudas.' });
    expect(inserts('movimentos_lote')[0]?.[1]).toEqual([LOTE, 'ajuste_contagem', -5, expect.any(String), null, null, 'u1', null]);
  });
});

describe('confirmação de tarefa (T5.5)', () => {
  function tarefaNoBanco(exigeLote = true) {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ id: TAREFA, exigeLote, exigeArea: false, eQuantitativa: true, unidadeMedida: 'un', participantes: [{ id: PESSOA, nome: 'Rogério', quantidade: null }] }],
    } as never);
  }

  it('tarefa inválida volta antes do banco', async () => {
    expect(await processarRegistro('confirmacao_tarefa', CHAVE, { id: 'x' }, usuario('gerencia'))).toEqual({
      status: 'recusado',
      error: 'Tarefa inválida.',
    });
    expectNoDatabase();
  });

  it('TA-32: sem o lote exigido não abre transação, e mantém o digitado', async () => {
    tarefaNoBanco();
    const resultado = await processarRegistro(
      'confirmacao_tarefa',
      CHAVE,
      { id: TAREFA, [`quantidade_${PESSOA}`]: '120' },
      usuario('gerencia'),
    );
    expect(resultado).toMatchObject({ status: 'recusado', error: expect.stringMatching(/exige o lote/) });
    expect(resultado.status === 'recusado' && resultado.fields).toMatchObject({ [`quantidade_${PESSOA}`]: '120' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('devolve o destino da tela: a tarefa, com a perda no endereço, ou a ficha do lote para a repicagem (UC-20 FA-1)', async () => {
    bancoCom();
    const gerencia = usuario('gerencia');
    tarefaNoBanco();
    expect(await processarRegistro('confirmacao_tarefa', CHAVE, { id: TAREFA, lote_id: LOTE }, gerencia)).toEqual({
      status: 'gravado',
      success: 'Tarefa confirmada.',
      destino: `/producao/agenda/${TAREFA}?feito=confirmada`,
      repetido: false,
    });
    tarefaNoBanco();
    expect(
      await processarRegistro('confirmacao_tarefa', CHAVE, { id: TAREFA, lote_id: LOTE, perdidas: '12', causa: 'seca' }, gerencia),
    ).toMatchObject({ destino: `/producao/agenda/${TAREFA}?feito=confirmada&perda=12&causa=seca` });
    tarefaNoBanco();
    expect(
      await processarRegistro('confirmacao_tarefa', CHAVE, { id: TAREFA, lote_id: LOTE, depois: 'repicar' }, gerencia),
    ).toMatchObject({ destino: `/producao/lotes/${LOTE}?repicar=${TAREFA}` });
    // O toque único da agenda do celular fica na lista
    tarefaNoBanco();
    const fica = await processarRegistro('confirmacao_tarefa', CHAVE, { id: TAREFA, lote_id: LOTE, depois: 'ficar' }, gerencia);
    expect(fica).toMatchObject({ status: 'gravado' });
    expect(fica).not.toHaveProperty('destino', expect.any(String));
  });
});
