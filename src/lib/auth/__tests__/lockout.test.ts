import { describe, expect, it } from 'vitest';
import { LOCK_MINUTES, MAX_FAILURES, isLocked, minutesLeft, registerFailure } from '../lockout';

const now = new Date('2026-09-14T10:00:00Z');

describe('registerFailure', () => {
  it('soma sem bloquear até a quarta falha', () => {
    expect(registerFailure(0, now)).toEqual({ tentativas: 1, bloqueadoAte: null });
    expect(registerFailure(3, now)).toEqual({ tentativas: 4, bloqueadoAte: null });
  });

  it('a quinta falha bloqueia por 15 minutos e zera a contagem', () => {
    const result = registerFailure(MAX_FAILURES - 1, now);
    expect(result.tentativas).toBe(0);
    expect(result.bloqueadoAte?.toISOString()).toBe('2026-09-14T10:15:00.000Z');
    expect(LOCK_MINUTES).toBe(15);
  });
});

describe('isLocked e minutesLeft', () => {
  it('bloqueado só enquanto a data não passou', () => {
    expect(isLocked(null, now)).toBe(false);
    expect(isLocked(new Date('2026-09-14T10:00:01Z'), now)).toBe(true);
    expect(isLocked(new Date('2026-09-14T10:00:00Z'), now)).toBe(false);
  });

  it('arredonda os minutos restantes para cima, com mínimo de 1', () => {
    expect(minutesLeft(new Date('2026-09-14T10:14:01Z'), now)).toBe(15);
    expect(minutesLeft(new Date('2026-09-14T10:00:10Z'), now)).toBe(1);
  });
});
