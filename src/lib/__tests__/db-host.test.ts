import { describe, expect, it } from 'vitest';
import { isLocalHost, isNeonHost } from '../db-host';

describe('isNeonHost', () => {
  it('reconhece o host do Neon, com e sem pooler', () => {
    expect(isNeonHost('postgresql://u:p@ep-abc-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require')).toBe(true);
    expect(isNeonHost('postgresql://u:p@ep-abc.sa-east-1.aws.neon.tech/neondb')).toBe(true);
  });

  it('trata localhost como banco local', () => {
    expect(isNeonHost('postgresql://postgres:a%25b@localhost:5432/tcc')).toBe(false);
    expect(isNeonHost('postgresql://postgres:x@127.0.0.1:5432/tcc')).toBe(false);
  });

  it('não se engana com neon.tech no meio do host ou fora dele', () => {
    expect(isNeonHost('postgresql://u:p@neon.tech.exemplo.com/db')).toBe(false);
    expect(isNeonHost('postgresql://neon.tech:p@localhost/db')).toBe(false);
  });

  it('URL inválida não é Neon', () => {
    expect(isNeonHost('não é url')).toBe(false);
    expect(isNeonHost('')).toBe(false);
  });
});

describe('isLocalHost', () => {
  it('reconhece o banco na própria máquina', () => {
    expect(isLocalHost('postgresql://postgres:x@localhost:5432/viveiro')).toBe(true);
    expect(isLocalHost('postgresql://postgres:x@127.0.0.1:5432/viveiro')).toBe(true);
    expect(isLocalHost('postgresql://postgres:x@[::1]:5432/viveiro')).toBe(true);
  });

  it('host remoto não é local, nem com localhost no usuário ou no subdomínio', () => {
    expect(isLocalHost('postgresql://u:p@10.0.0.5:5432/viveiro')).toBe(false);
    expect(isLocalHost('postgresql://u:p@ep-abc.sa-east-1.aws.neon.tech/neondb')).toBe(false);
    expect(isLocalHost('postgresql://localhost:p@banco.exemplo.com/db')).toBe(false);
    expect(isLocalHost('postgresql://u:p@localhost.exemplo.com/db')).toBe(false);
  });

  it('URL inválida não é local', () => {
    expect(isLocalHost('não é url')).toBe(false);
  });
});
