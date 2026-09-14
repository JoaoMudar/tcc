import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GENERIC_MESSAGE, UserError, toUserMessage } from '../errors';

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

describe('toUserMessage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra a mensagem do UserError como está, sem logar', () => {
    expect(toUserMessage(new UserError('Quantidade maior que o saldo do lote.'))).toBe(
      'Quantidade maior que o saldo do lote.',
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('traduz violação de unicidade sem vazar o texto do Postgres', () => {
    const msg = toUserMessage(
      pgError('23505', 'duplicate key value violates unique constraint "canteiros_area_id_numero_key"'),
    );
    expect(msg).toBe('Já existe um cadastro com esses dados.');
    expect(msg).not.toContain('constraint');
    expect(console.error).toHaveBeenCalledOnce();
  });

  it.each(['23503', '23502', '23514', '22P02', '22003', '40001', '40P01'])(
    'tem mensagem própria para %s',
    (code) => {
      const msg = toUserMessage(pgError(code, 'texto interno do banco'));
      expect(msg).not.toBe(GENERIC_MESSAGE);
      expect(msg).not.toContain('texto interno');
    },
  );

  it('usa a mensagem genérica para o resto', () => {
    expect(toUserMessage(pgError('XX000', 'internal error'))).toBe(GENERIC_MESSAGE);
    expect(toUserMessage(new Error('connect ECONNREFUSED 127.0.0.1:5432'))).toBe(GENERIC_MESSAGE);
    expect(toUserMessage('string solta')).toBe(GENERIC_MESSAGE);
    expect(toUserMessage(null)).toBe(GENERIC_MESSAGE);
  });
});
