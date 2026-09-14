import { describe, expect, it } from 'vitest';
import { isUuid } from '../uuid';

describe('isUuid', () => {
  it('aceita UUID em qualquer caixa', () => {
    expect(isUuid('3f2b8c1e-9a4d-4e7b-8c21-0d5e6f7a8b9c')).toBe(true);
    expect(isUuid('3F2B8C1E-9A4D-4E7B-8C21-0D5E6F7A8B9C')).toBe(true);
  });

  it('recusa o resto', () => {
    expect(isUuid('abc')).toBe(false);
    expect(isUuid("3f2b8c1e-9a4d-4e7b-8c21-0d5e6f7a8b9c' OR 1=1")).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
