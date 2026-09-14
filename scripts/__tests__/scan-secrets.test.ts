// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findSecrets, isForbiddenPath } from '../scan-secrets.mjs';

// Os valores falsos são montados por partes para este arquivo não disparar a própria varredura
const fake = (...parts: string[]) => parts.join('');
const file = (path: string, content = '') => ({ path, content });

describe('isForbiddenPath', () => {
  it('bloqueia .env e variantes, libera o exemplo', () => {
    expect(isForbiddenPath('.env')).toBe(true);
    expect(isForbiddenPath('.env.local')).toBe(true);
    expect(isForbiddenPath('app/.env.production')).toBe(true);
    expect(isForbiddenPath('.env.example')).toBe(false);
    expect(isForbiddenPath('src/lib/env.ts')).toBe(false);
  });
});

describe('findSecrets', () => {
  it('não acusa código limpo nem URL de exemplo', () => {
    expect(
      findSecrets([
        file('.env.example', 'DATABASE_URL=postgresql://postgres:<senha>@localhost:5432/tcc'),
        file('ci.yml', 'postgresql://postgres:postgres@localhost:5432/viveiro_test'),
        file('teste.ts', "'postgresql://u:p@ep-x.neon.tech/db'"),
        file('a.ts', 'const x = `postgresql://${user}:${pass}@host/db`'),
      ]),
    ).toEqual([]);
  });

  it('acusa .env no stage mesmo vazio', () => {
    expect(findSecrets([file('.env.local')])).toEqual(['.env.local: arquivo .env não pode ser versionado']);
  });

  it('acusa URL com senha real, codificada ou não', () => {
    const url = fake('postgresql://postgres:', 'Mudar2026', '%25', '@localhost:5432/tcc');
    expect(findSecrets([file('config.ts', url)])).toEqual(['config.ts: URL de banco com senha']);
  });

  it.each([
    ['senha do Neon', fake('npg_', 'AbCdEf123456')],
    ['chave privada', fake('-----BEGIN ', 'PRIVATE KEY-----')],
    ['token do GitHub', fake('ghp_', 'a'.repeat(36))],
    ['chave da AWS', fake('AKIA', 'ABCDEFGHIJKLMNOP')],
  ])('acusa %s', (rule, content) => {
    expect(findSecrets([file('x.txt', content)])).toEqual([`x.txt: ${rule}`]);
  });
});
