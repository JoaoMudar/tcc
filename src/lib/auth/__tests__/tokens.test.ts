// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { generateSessionToken, hashToken } from '../tokens';

describe('tokens de sessão', () => {
  it('gera tokens longos e distintos', () => {
    const tokens = new Set(Array.from({ length: 50 }, generateSessionToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('o resumo é estável, não revela o token e muda com ele', () => {
    const token = generateSessionToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).not.toBe(hashToken(generateSessionToken()));
  });
});
