import { describe, expect, it } from 'vitest';
import { SEM_PESSOA, duplicateMessage, escapeLike, parseUsuarioFields, validateLogin, wouldRemoveLastAdmin } from '../usuarios';

describe('validateLogin', () => {
  it('aceita login simples', () => {
    expect(validateLogin('debora')).toBeNull();
    expect(validateLogin('joao.pires-2')).toBeNull();
  });

  it.each(['jo', 'Debora', 'débora', 'joão pires', 'a'.repeat(33)])('recusa "%s"', (login) => {
    expect(validateLogin(login)).toContain('3 a 32');
  });
});

describe('parseUsuarioFields', () => {
  const pessoa = '3f2b8c1e-9a4d-4e7b-8c21-0d5e6f7a8b9c';

  it('limpa o nome e converte a pessoa', () => {
    expect(parseUsuarioFields({ nomeExibicao: '  Débora ', perfil: 'gerencia', pessoaId: pessoa })).toEqual({
      value: { nomeExibicao: 'Débora', perfil: 'gerencia', pessoaId: pessoa },
    });
    expect(parseUsuarioFields({ nomeExibicao: 'João', perfil: 'admin', pessoaId: SEM_PESSOA })).toEqual({
      value: { nomeExibicao: 'João', perfil: 'admin', pessoaId: null },
    });
  });

  it('recusa perfil fora da lista, nome curto e pessoa forjada', () => {
    expect(parseUsuarioFields({ nomeExibicao: 'Débora', perfil: 'colaborador', pessoaId: SEM_PESSOA })).toEqual({
      error: 'Escolha o perfil.',
    });
    expect(parseUsuarioFields({ nomeExibicao: 'D', perfil: 'chefia', pessoaId: SEM_PESSOA })).toHaveProperty('error');
    expect(parseUsuarioFields({ nomeExibicao: 'Débora', perfil: 'chefia', pessoaId: "1' OR '1" })).toEqual({
      error: 'Pessoa inválida. Escolha da lista.',
    });
  });
});

describe('duplicateMessage', () => {
  it('distingue login repetido de pessoa já vinculada', () => {
    expect(duplicateMessage({ code: '23505', constraint: 'usuarios_login_key' })).toBe('Já existe usuário com esse login.');
    expect(duplicateMessage({ code: '23505', constraint: 'usuarios_uma_credencial_por_pessoa' })).toBe(
      'Essa pessoa já tem um usuário.',
    );
    expect(duplicateMessage({ code: '23503' })).toBeNull();
    expect(duplicateMessage(new Error('x'))).toBeNull();
  });
});

describe('wouldRemoveLastAdmin', () => {
  const admin = { perfil: 'admin' as const, ativo: true };

  it('recusa rebaixar ou desativar o único admin ativo', () => {
    expect(wouldRemoveLastAdmin(admin, { perfil: 'chefia', ativo: true }, 0)).toBe(true);
    expect(wouldRemoveLastAdmin(admin, { perfil: 'admin', ativo: false }, 0)).toBe(true);
  });

  it('permite quando sobra outro admin, ou quando não era admin', () => {
    expect(wouldRemoveLastAdmin(admin, { perfil: 'chefia', ativo: true }, 1)).toBe(false);
    expect(wouldRemoveLastAdmin({ perfil: 'gerencia', ativo: true }, { perfil: 'gerencia', ativo: false }, 0)).toBe(false);
    expect(wouldRemoveLastAdmin(admin, admin, 0)).toBe(false);
  });
});

describe('escapeLike', () => {
  it('trata % e _ como texto na busca', () => {
    expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
  });
});
