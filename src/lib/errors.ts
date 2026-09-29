/**
 * Erro com mensagem escrita para o usuário: validação e regra de negócio.
 * É o único erro cuja mensagem vai para a tela como está.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

export const GENERIC_MESSAGE =
  'Não foi possível concluir. Tente de novo e, se continuar, avise o administrador.';

// SQLSTATE do Postgres traduzido para a língua de quem usa o sistema
const PG_MESSAGES: Record<string, string> = {
  '23505': 'Já existe um cadastro com esses dados.',
  '23503': 'Este registro está ligado a outro e não pode ser alterado ou excluído assim.',
  '23502': 'Falta preencher um campo obrigatório.',
  '23514': 'Algum valor está fora do permitido. Confira os campos.',
  '22P02': 'Algum valor está em formato inválido. Confira os campos.',
  '22003': 'Algum número está grande demais.',
  '40001': 'Outra pessoa alterou isto ao mesmo tempo. Tente de novo.',
  '40P01': 'Outra pessoa alterou isto ao mesmo tempo. Tente de novo.',
};

function pgCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Mensagem segura para a tela. Nunca devolve texto do Postgres: o erro
 * original fica só no log do servidor.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof UserError) return error.message;
  console.error(error);
  const code = pgCode(error);
  return (code && PG_MESSAGES[code]) || GENERIC_MESSAGE;
}

// Conflito de concorrência: tentar de novo pode dar certo
const PG_TRANSITORIOS = new Set(['40001', '40P01']);

/**
 * O erro que repetir não resolve: regra de negócio ou dado recusado pelo banco.
 * A fila do aparelho (RNF-05) usa isto para separar o registro recusado, que
 * espera a pessoa, do que falhou por acaso e vai sozinho na próxima tentativa.
 */
export function isErroDefinitivo(error: unknown): boolean {
  if (error instanceof UserError) return true;
  const code = pgCode(error);
  return code !== undefined && code in PG_MESSAGES && !PG_TRANSITORIOS.has(code);
}
