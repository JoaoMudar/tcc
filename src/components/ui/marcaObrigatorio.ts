/**
 * Asterisco vermelho depois do rótulo do campo obrigatório; o opcional não leva
 * marca nenhuma. É pseudo-elemento de CSS, e não texto: o nome acessível do
 * campo continua o mesmo, e o leitor de tela já anuncia "obrigatório" pelo
 * atributo `required`.
 */
export const MARCA_OBRIGATORIO = "after:ml-0.5 after:font-bold after:text-red-600 after:content-['*']";

/** Classe do rótulo visível dos campos de formulário, com a marca quando exigido. */
export function classeRotulo(obrigatorio: boolean | undefined): string {
  return `text-sm font-semibold text-gray-700 ${obrigatorio ? MARCA_OBRIGATORIO : ''}`.trim();
}
