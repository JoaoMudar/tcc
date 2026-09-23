import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

type ScryptOptions = { N: number; r: number; p: number; maxmem: number };

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

// Parâmetros gravados junto com o hash: dá para endurecer depois sem invalidar as senhas antigas
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Hash de senha com scrypt e sal aleatório (RNF-08). Formato: scrypt$N$r$p$sal$hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEMORY });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  if (expected.length === 0) return false;
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEMORY,
  });
  return timingSafeEqual(key, expected);
}

/** Verificações de senha rodando ao mesmo tempo nesta instância (SEC-009). */
export const MAX_VERIFICACOES_SIMULTANEAS = 8;
let emCurso = 0;

/**
 * Roda a verificação se houver vaga; `null` quando a instância já está no limite.
 * O contador por origem barra o ataque em série, mas uma rajada simultânea lê a
 * contagem antes de qualquer falha ser gravada: o teto limita o scrypt em curso.
 */
export async function comVagaDeVerificacao<T>(verificar: () => Promise<T>): Promise<T | null> {
  if (emCurso >= MAX_VERIFICACOES_SIMULTANEAS) return null;
  emCurso++;
  try {
    return await verificar();
  } finally {
    emCurso--;
  }
}

let dummyHash: Promise<string> | undefined;

/** Gasta o mesmo tempo de uma verificação real, para o login inexistente não se denunciar pela demora. */
export async function dummyVerify(password: string): Promise<void> {
  dummyHash ??= hashPassword('senha-de-referencia-que-nao-existe');
  await verifyPassword(password, await dummyHash);
}

const PREDICTABLE = new Set([
  '12345678', '123456789', '1234567890', '87654321', 'abcdefgh', 'abc12345',
  'password', 'qwertyui', 'senha123', 'senha1234', 'mudar123', 'viveiro1', 'viveiro123', 'mudas123',
]);

function simplify(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Política de senha (E4 A-01): recusa a previsível no momento em que é definida.
 * Devolve a mensagem para o usuário, ou null se a senha serve.
 */
export function validateNewPassword(password: string, context: { login?: string; nome?: string } = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (password.length > MAX_PASSWORD_LENGTH) return 'A senha pode ter no máximo 128 caracteres.';
  if (/^\d+$/.test(password)) {
    return 'Use letras também, e não só números: data de nascimento é fácil de adivinhar.';
  }
  if (/^(.)\1+$/.test(password)) return 'A senha não pode ser um caractere repetido.';

  const simple = simplify(password);
  if (PREDICTABLE.has(simple)) return 'Essa senha é fácil de adivinhar. Escolha outra.';
  if (context.login && context.login.length >= 3 && simple.includes(simplify(context.login))) {
    return 'A senha não pode conter o seu usuário.';
  }
  const names = simplify(context.nome ?? '').split(/\s+/).filter((part) => part.length >= 3);
  if (names.some((name) => simple.includes(name))) return 'A senha não pode conter o seu nome.';
  return null;
}
