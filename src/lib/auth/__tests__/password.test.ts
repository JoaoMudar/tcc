// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  MAX_VERIFICACOES_SIMULTANEAS,
  comVagaDeVerificacao,
  dummyVerify,
  hashPassword,
  validateNewPassword,
  verifyPassword,
} from '../password';

describe('hashPassword e verifyPassword', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hashPassword('Araucaria#2026');
    expect(await verifyPassword('Araucaria#2026', hash)).toBe(true);
    expect(await verifyPassword('araucaria#2026', hash)).toBe(false);
  });

  it('não guarda a senha legível e usa sal diferente a cada vez (RNF-08)', async () => {
    const a = await hashPassword('Araucaria#2026');
    const b = await hashPassword('Araucaria#2026');
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    expect(a).not.toContain('Araucaria');
    expect(a).not.toBe(b);
  });

  it('hash malformado nunca confere', async () => {
    expect(await verifyPassword('qualquer', 'texto-sem-formato')).toBe(false);
    expect(await verifyPassword('qualquer', 'bcrypt$1$2$3$4$5')).toBe(false);
    expect(await verifyPassword('qualquer', 'scrypt$16384$8$1$c2Fs$')).toBe(false);
  });

  it('a verificação fictícia não lança', async () => {
    await expect(dummyVerify('qualquer')).resolves.toBeUndefined();
  });
});

describe('comVagaDeVerificacao (SEC-009)', () => {
  function pendente() {
    let soltar!: (valor: boolean) => void;
    const promessa = new Promise<boolean>((resolve) => {
      soltar = resolve;
    });
    return { promessa, soltar };
  }

  it('recusa acima do teto e devolve a vaga quando uma termina', async () => {
    const abertas = Array.from({ length: MAX_VERIFICACOES_SIMULTANEAS }, () => pendente());
    const emCurso = abertas.map((p) => comVagaDeVerificacao(() => p.promessa));
    expect(await comVagaDeVerificacao(async () => true)).toBeNull();

    abertas[0].soltar(true);
    expect(await emCurso[0]).toBe(true);
    expect(await comVagaDeVerificacao(async () => true)).toBe(true);

    abertas.slice(1).forEach((p) => p.soltar(false));
    await Promise.all(emCurso);
  });

  it('devolve a vaga mesmo quando a verificação lança', async () => {
    const abertas = Array.from({ length: MAX_VERIFICACOES_SIMULTANEAS - 1 }, () => pendente());
    const emCurso = abertas.map((p) => comVagaDeVerificacao(() => p.promessa));
    await expect(comVagaDeVerificacao(async () => Promise.reject(new Error('falhou')))).rejects.toThrow('falhou');
    expect(await comVagaDeVerificacao(async () => true)).toBe(true);

    abertas.forEach((p) => p.soltar(false));
    await Promise.all(emCurso);
  });
});

describe('validateNewPassword', () => {
  const context = { login: 'debora', nome: 'Débora Schmitt' };

  it('aceita senha razoável', () => {
    expect(validateNewPassword('Canteiro-A3-tubete', context)).toBeNull();
  });

  it.each([
    ['curta', 'abc123', '8 caracteres'],
    ['só números, como data', '14091980', 'só números'],
    ['caractere repetido', 'aaaaaaaa', 'repetido'],
    ['previsível', 'Senha123', 'fácil de adivinhar'],
    ['contém o usuário', 'debora2026!', 'usuário'],
    ['contém o nome, sem acento', 'schmitt#2026', 'nome'],
    ['contém o nome, com acento', 'Débora#2026x', 'usuário'],
  ])('recusa senha %s', (_caso, senha, trecho) => {
    expect(validateNewPassword(senha, context)).toContain(trecho);
  });
});
