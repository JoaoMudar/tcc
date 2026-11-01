// Lógica pura do `captura-telas.mjs`, separada para teste: filtro da lista de
// telas, padrões de dado sensível e o HTML que monta desktop e celular lado a lado.

/** Os dois tamanhos de tela. O celular é o de um iPhone 12/13, o mais comum entre os usuários. */
export const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

/** Altura comum das duas imagens na composição, em pixels CSS, e o espaço entre elas. */
export const ALTURA_COMPOSICAO = 800;
export const ESPACO = 28;

/**
 * Filtra as telas pelos ids da linha de comando e pelo banco em uso.
 * Sem id, todas as do banco.
 *
 * @template {{ id: string, banco: string }} T
 * @param {T[]} telas
 * @param {{ ids?: string[], banco?: string | null }} [filtro]
 * @returns {T[]}
 */
export function filtraTelas(telas, { ids = [], banco = null } = {}) {
  return telas.filter((t) => (ids.length === 0 || ids.includes(t.id)) && (!banco || t.banco === banco));
}

/**
 * Descobre a origem (`espelho`, `dev`) pelo nome do banco na DATABASE_URL. O app e o
 * script leem a mesma variável, então a tela sai sempre do banco que ela pede.
 */
export function origemDoBanco(databaseUrl, bancos) {
  const nome = new URL(databaseUrl).pathname.replace(/^\//, '');
  const origem = Object.entries(bancos).find(([, banco]) => banco === nome)?.[0];
  if (!origem) {
    throw new Error(`DATABASE_URL aponta para "${nome}", que não está em BANCOS (${Object.values(bancos).join(', ')})`);
  }
  return origem;
}

/** Troca o `:id` da rota pelo valor consultado. */
export function montaUrl(rota, id) {
  if (!rota.includes(':id')) return rota;
  if (id == null) throw new Error(`a rota ${rota} precisa de id e a consulta não devolveu linha`);
  return rota.replace(':id', encodeURIComponent(String(id)));
}

/**
 * Textos que não podem sair legíveis: cada coluna da linha é um dado de cliente
 * (nome, documento, e-mail, endereço, observação). Descarta vazios e textos curtos demais, que borrariam meia tela por acaso.
 */
export function textosSensiveis(linhas) {
  const textos = new Set();
  for (const linha of linhas) {
    for (const campo of Object.values(linha)) {
      const t = String(campo ?? '').trim();
      if (t.length >= 4) textos.add(t);
    }
  }
  return [...textos];
}

/** Valor em reais como o `Intl.NumberFormat('pt-BR', currency BRL)` escreve. */
export const PADRAO_MOEDA = 'R\\$\\s?-?[\\d.]+,\\d{2}';

/**
 * Telefone, CPF, CNPJ e CEP como a tela escreve. O banco guarda o telefone só com
 * dígitos e a tela o formata, então a comparação com o texto do banco não basta.
 */
export const PADRAO_CONTATO = [
  String.raw`\(\d{2}\)\s?\d{4,5}-?\d{4}`, // (47) 99999-0000
  String.raw`\b\d{2}\s?\d{4,5}-\d{4}\b`, // 47 99999-0000
  String.raw`\b\d{3}\.\d{3}\.\d{3}-\d{2}\b`, // CPF
  String.raw`\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b`, // CNPJ
  String.raw`\b\d{5}-\d{3}\b`, // CEP
  String.raw`\b\d{10,14}\b`, // telefone ou documento sem máscara
].join('|');

/**
 * Credenciais do perfil vindas do ambiente: `CAPTURA_LOGIN_GERENCIA`, `CAPTURA_SENHA_GERENCIA`.
 *
 * @param {string} perfil
 * @param {Record<string, string | undefined>} [env]
 */
export function credenciais(perfil, env = process.env) {
  const chave = perfil.toUpperCase();
  const login = env[`CAPTURA_LOGIN_${chave}`];
  const senha = env[`CAPTURA_SENHA_${chave}`];
  if (!login || !senha) {
    throw new Error(`Faltam CAPTURA_LOGIN_${chave} e CAPTURA_SENHA_${chave} no .env.local`);
  }
  return { login, senha };
}

/**
 * Página que junta os dois prints na mesma altura, desktop à esquerda e celular à
 * direita. Cada imagem ganha borda cinza fina, para a tela branca não se perder no
 * papel branco, e o celular ganha cantos arredondados para ler como aparelho.
 */
export function htmlComposicao(desktopPng, celularPng) {
  const src = (buf) => `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: #fff; }
  #composicao { display: inline-flex; gap: ${ESPACO}px; align-items: flex-start; padding: 2px; background: #fff; }
  img { display: block; height: ${ALTURA_COMPOSICAO}px; width: auto; border: 1.5px solid #9a9a9a; }
  .celular { border-radius: 22px; }
  .desktop { border-radius: 4px; }
</style></head><body><div id="composicao">
  <img class="desktop" alt="" src="${src(desktopPng)}">
  <img class="celular" alt="" src="${src(celularPng)}">
</div></body></html>`;
}
