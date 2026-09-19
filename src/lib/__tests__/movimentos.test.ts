import { describe, expect, it, vi } from 'vitest';
import { UserError } from '../errors';
import { type LoteTravado, registrarMovimento, sinalValido } from '../movimentos';

const LOTE: LoteTravado = {
  id: 'l1',
  codigo: '2026-0001',
  especieId: 'e1',
  recipienteId: 'r1',
  canteiroId: 'c1',
  quantidadeAtual: 200,
  encerrado: false,
};

/** Cliente de transação falso: responde pela forma do SQL e guarda a ordem das consultas. */
function cliente(lote: LoteTravado | null = LOTE) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- os parâmetros entram no registro de chamadas
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('MAX(posicao)')) return { rows: [{ posicao: 3 }], rowCount: 1 };
    if (sql.includes('FROM canteiros')) return { rows: [{ id: 'c2' }], rowCount: 1 };
    if (sql.includes('FROM lotes') && sql.includes('FOR UPDATE')) return { rows: lote ? [lote] : [], rowCount: lote ? 1 : 0 };
    return { rows: [], rowCount: 1 };
  });
  return { query } as unknown as Parameters<typeof registrarMovimento>[0] & { query: typeof query };
}

const escritas = (c: ReturnType<typeof cliente>) =>
  c.query.mock.calls.filter(([sql]) => /^\s*(INSERT|UPDATE)/.test(sql)).map(([sql, params]) => ({ sql, params }));

describe('sinalValido', () => {
  it('entrada soma, saída subtrai, ajuste vai para os dois lados, zero nunca', () => {
    expect(sinalValido('entrada', 10)).toBe(true);
    expect(sinalValido('entrada', -10)).toBe(false);
    expect(sinalValido('perda', -10)).toBe(true);
    expect(sinalValido('perda', 10)).toBe(false);
    expect(sinalValido('venda', -1)).toBe(true);
    expect(sinalValido('repicagem_saida', 5)).toBe(false);
    expect(sinalValido('ajuste_contagem', -3)).toBe(true);
    expect(sinalValido('ajuste_contagem', 3)).toBe(true);
    expect(sinalValido('ajuste_contagem', 0)).toBe(false);
    expect(sinalValido('perda', -1.5)).toBe(false);
  });
});

describe('registrarMovimento, a porta única', () => {
  it('trava o lote antes de qualquer escrita', async () => {
    const c = cliente();
    await registrarMovimento(c, { loteId: 'l1', tipo: 'perda', quantidade: -50, causa: 'seca', registradoPor: 'u1', data: '2026-09-14' });
    expect(c.query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
  });

  it('perda grava o movimento com causa e baixa o saldo', async () => {
    const c = cliente();
    const resultado = await registrarMovimento(c, {
      loteId: 'l1',
      tipo: 'perda',
      quantidade: -50,
      causa: 'seca',
      registradoPor: 'u1',
      data: '2026-09-14',
    });
    expect(resultado).toEqual({ saldo: 150, encerrado: false });
    const [insert, update] = escritas(c);
    expect(insert.params).toEqual(['l1', 'perda', -50, '2026-09-14', 'seca', null, 'u1', null]);
    expect(update.params).toEqual(['l1', 150]);
  });

  it('TA-20: perda maior que o saldo é recusada com o saldo, e nada é gravado', async () => {
    const c = cliente();
    const erro = await registrarMovimento(c, { loteId: 'l1', tipo: 'perda', quantidade: -250, causa: 'praga', registradoPor: 'u1' }).catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(UserError);
    expect((erro as Error).message).toContain('tem 200 mudas');
    expect(escritas(c)).toEqual([]);
  });

  it('saldo zero encerra o lote e libera o canteiro (RN-22)', async () => {
    const c = cliente();
    const resultado = await registrarMovimento(c, { loteId: 'l1', tipo: 'perda', quantidade: -200, causa: 'geada', registradoPor: 'u1' });
    expect(resultado).toEqual({ saldo: 0, encerrado: true });
    const update = escritas(c)[1].sql;
    expect(update).toMatch(/encerrado_em = NOW\(\)/);
    expect(update).toMatch(/canteiro_id = NULL/);
    expect(update).toMatch(/motivo_encerramento = 'saldo_zero'/);
  });

  it('RF-53: encerrado o lote, as ordens do protocolo ainda planejadas são canceladas, e não apagadas', async () => {
    const c = cliente();
    await registrarMovimento(c, { loteId: 'l1', tipo: 'venda', quantidade: -200, registradoPor: 'u1' });

    const cancelamento = escritas(c).find(({ sql }) => sql.includes('atribuicoes'));
    expect(cancelamento).toBeDefined();
    expect(cancelamento!.sql).toMatch(/SET situacao = 'cancelada'/);
    expect(cancelamento!.sql).toMatch(/lote_etapa_id IS NOT NULL/);
    // A confirmada e a não confirmada são passado, e o encerramento não as reescreve
    expect(cancelamento!.sql).toMatch(/situacao = 'planejada'/);
    expect(cancelamento!.sql).not.toMatch(/DELETE/);
    expect(cancelamento!.params).toEqual(['l1']);
  });

  it('o lote que continua aberto não cancela ordem nenhuma', async () => {
    const c = cliente();
    await registrarMovimento(c, { loteId: 'l1', tipo: 'perda', quantidade: -50, causa: 'seca', registradoPor: 'u1' });
    expect(escritas(c).some(({ sql }) => sql.includes('atribuicoes'))).toBe(false);
  });

  it('lote encerrado ou inexistente não recebe movimento', async () => {
    await expect(
      registrarMovimento(cliente({ ...LOTE, encerrado: true }), { loteId: 'l1', tipo: 'venda', quantidade: -1, registradoPor: 'u1' }),
    ).rejects.toThrow('está encerrado');
    await expect(registrarMovimento(cliente(null), { loteId: 'l1', tipo: 'venda', quantidade: -1, registradoPor: 'u1' })).rejects.toThrow(
      'Lote não encontrado.',
    );
  });

  it('sinal errado para o tipo é recusado antes de escrever', async () => {
    const c = cliente();
    await expect(registrarMovimento(c, { loteId: 'l1', tipo: 'entrada', quantidade: -10, registradoPor: 'u1' })).rejects.toThrow(
      'Quantidade inválida',
    );
    expect(escritas(c)).toEqual([]);
  });

  it('transferência muda canteiro e posição, sem mexer no saldo', async () => {
    const c = cliente();
    const resultado = await registrarMovimento(c, {
      loteId: 'l1',
      tipo: 'transferencia',
      canteiroDestinoId: 'c2',
      registradoPor: 'u1',
      data: '2026-09-14',
    });
    expect(resultado).toEqual({ saldo: 200, encerrado: false });
    const [insert, update] = escritas(c);
    expect(insert.params).toEqual(['l1', '2026-09-14', 'c1', 'c2', null, 'u1', null]);
    expect(update.params).toEqual(['l1', 'c2', 3]);
  });

  it('transferência para o próprio canteiro é recusada', async () => {
    await expect(
      registrarMovimento(cliente(), { loteId: 'l1', tipo: 'transferencia', canteiroDestinoId: 'c1', registradoPor: 'u1' }),
    ).rejects.toThrow('já está nesse canteiro');
  });
});
