import { describe, expect, it } from 'vitest';
import { formatDateTime } from '../format';

describe('formatDateTime', () => {
  it('mostra no horário de Brasília, mesmo com servidor em UTC', () => {
    expect(formatDateTime(new Date('2026-09-14T10:15:00Z'))).toBe('14/09/2026 07:15');
  });

  it('vira o dia pelo fuso do viveiro', () => {
    expect(formatDateTime(new Date('2026-09-15T02:30:00Z'))).toBe('14/09/2026 23:30');
  });
});
