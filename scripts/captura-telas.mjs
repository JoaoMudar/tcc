// Tira os prints das telas do capítulo 5 no desktop e no celular e junta os dois numa
// imagem só, lado a lado, pronta para o Word. A lista de telas está em
// `captura-telas.config.mjs`.
//
// Pré-requisitos:
//   1. `npm run dev` rodando, com a DATABASE_URL do .env.local apontando para o banco
//      que se quer fotografar (viveiro_espelho ou tcc). O script roda só as telas desse banco.
//      Trocou a DATABASE_URL? Reinicie o servidor: o pool fica em globalThis e segue no banco
//      antigo, e no banco `tcc` o script não borra nada, então uma tela do espelho sairia legível.
//   2. No .env.local, as credenciais de cada perfil usado:
//      CAPTURA_LOGIN_CHEFIA / CAPTURA_SENHA_CHEFIA, idem GERENCIA e ADMIN.
//      Opcional: CAPTURA_URL (padrão http://localhost:3000).
//
//   node scripts/captura-telas.mjs                  # todas as telas do banco em uso
//   node scripts/captura-telas.mjs 5-4-carteira     # só uma (ou várias, separadas por espaço)
//
// Saída: docs/tcc-figuras/telas/<id>.png (composição) e telas/brutos/<id>-desktop.png e
// <id>-celular.png. No Word, a composição entra com a largura da mancha (16 cm).
//
// DADO SENSÍVEL: no banco espelho, nome, telefone, documento, e-mail e endereço de todo
// cliente, as observações dos pedidos e todo valor em R$ saem borrados. O borrão é aplicado no navegador, na hora do print; o app
// não muda.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import nextEnv from '@next/env';
import pg from 'pg';
import { chromium } from 'playwright';
import {
  PADRAO_CONTATO,
  PADRAO_MOEDA,
  VIEWPORTS,
  credenciais,
  filtraTelas,
  htmlComposicao,
  montaUrl,
  origemDoBanco,
  textosSensiveis,
} from './captura-telas-lib.mjs';
import { BANCOS, TELAS } from './captura-telas.config.mjs';

nextEnv.loadEnvConfig(process.cwd());

const BASE = process.env.CAPTURA_URL ?? 'http://localhost:3000';
const SAIDA = join('docs', 'tcc-figuras', 'telas');
const BRUTOS = join(SAIDA, 'brutos');

/** Some com o que é do ambiente de desenvolvimento e não do sistema. */
const CSS_PRINT = `nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }
* { caret-color: transparent !important; }`;

/** Borra, no navegador, todo elemento cujo texto contém um dado sensível. */
function borraNoNavegador({ textos, padroes }) {
  const regex = padroes.map((p) => new RegExp(p));
  const sensivel = (t) => t && (regex.some((r) => r.test(t)) || textos.some((s) => t.includes(s)));
  const borra = (el) => {
    el.style.filter = 'blur(6px)';
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let no = walker.nextNode(); no; no = walker.nextNode()) {
    if (sensivel(no.textContent) && no.parentElement) borra(no.parentElement);
  }
  for (const campo of document.querySelectorAll('input, textarea')) {
    if (sensivel(campo.value)) borra(campo);
  }
  for (const opcao of document.querySelectorAll('select')) {
    if (sensivel(opcao.selectedOptions[0]?.textContent)) borra(opcao);
  }
}

async function entra(browser, perfil) {
  const { login, senha } = credenciais(perfil);
  const contexto = await browser.newContext(VIEWPORTS.desktop);
  const page = await contexto.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Usuário').fill(login);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 }),
    page.getByRole('button', { name: /entrar/i }).click(),
  ]);
  if (new URL(page.url()).pathname.startsWith('/trocar-senha')) {
    throw new Error(`o usuário ${login} precisa trocar a senha antes; entre uma vez pelo navegador`);
  }
  const estado = await contexto.storageState();
  await contexto.close();
  return estado;
}

async function fotografa(browser, tela, url, estado, tamanho, textos) {
  const contexto = await browser.newContext({
    ...VIEWPORTS[tamanho],
    storageState: estado ?? undefined,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await contexto.newPage();
  const resposta = await page.goto(`${BASE}${url}`, { waitUntil: 'load' });
  // 404 num id que veio do banco: o servidor está em outro banco (ver os pré-requisitos)
  if (resposta && resposta.status() >= 400) {
    throw new Error(`${url} respondeu ${resposta.status()}; o servidor foi reiniciado depois de trocar a DATABASE_URL?`);
  }
  // Uma tela que nunca fica ociosa (`/pedidos` refaz a requisição em laço) não pode travar a captura
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {
    console.warn(`  aviso: ${url} não ficou ociosa em 10 s; print sem esperar a rede`);
  });
  if (new URL(page.url()).pathname !== new URL(`${BASE}${url}`).pathname) {
    console.warn(`  aviso: ${url} redirecionou para ${new URL(page.url()).pathname}`);
  }
  if (tela.esperar) await page.locator(tela.esperar).first().waitFor();
  if (tela.offline) {
    await contexto.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(800);
  }
  await page.evaluate(() => document.fonts.ready);
  if (tela.banco === 'espelho') {
    await page.evaluate(borraNoNavegador, { textos, padroes: [PADRAO_MOEDA, PADRAO_CONTATO] });
  }
  const png = await page.screenshot({ animations: 'disabled', caret: 'hide', style: CSS_PRINT });
  await contexto.close();
  return png;
}

async function compoe(browser, desktop, celular) {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(htmlComposicao(desktop, celular));
  await page.locator('img').last().evaluate((img) => img.decode());
  const png = await page.locator('#composicao').screenshot();
  await page.close();
  return png;
}

async function main() {
  const banco = origemDoBanco(process.env.DATABASE_URL, BANCOS);
  const ids = process.argv.slice(2);
  const telas = filtraTelas(TELAS, { ids, banco });
  if (telas.length === 0) {
    console.log(`Nenhuma tela para o banco "${banco}"${ids.length ? ` com os ids ${ids.join(', ')}` : ''}.`);
    return;
  }

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const browser = await chromium.launch();
  try {
    const textos =
      banco === 'espelho'
        ? textosSensiveis(
            (
              await db.query(`SELECT p.nome, p.telefone, p.documento, p.email, p.observacoes,
                                     e.logradouro, e.bairro, e.cep
                              FROM pessoas p
                              JOIN pessoas_papeis pp ON pp.pessoa_id = p.id AND pp.papel = 'cliente'
                              LEFT JOIN pessoas_enderecos e ON e.pessoa_id = p.id
                              UNION ALL
                              SELECT NULL, NULL, NULL, NULL, observacoes, entrega_logradouro, frete_origem_endereco, entrega_cep
                              FROM pedidos
                              UNION ALL
                              SELECT NULL, NULL, NULL, NULL, NULL, endereco, NULL, NULL FROM viagens_paradas`)
            ).rows,
          )
        : [];

    mkdirSync(BRUTOS, { recursive: true });
    const sessoes = new Map();
    console.log(`Banco ${banco}: ${telas.length} tela(s).`);

    for (const tela of telas) {
      const id = tela.sql ? (await db.query(tela.sql)).rows[0]?.id : null;
      const url = montaUrl(tela.url, id);
      if (tela.perfil && !sessoes.has(tela.perfil)) sessoes.set(tela.perfil, await entra(browser, tela.perfil));
      const estado = tela.perfil ? sessoes.get(tela.perfil) : null;

      console.log(`- ${tela.id}  ${url}`);
      const desktop = await fotografa(browser, tela, url, estado, 'desktop', textos);
      const celular = await fotografa(browser, tela, url, estado, 'celular', textos);
      writeFileSync(join(BRUTOS, `${tela.id}-desktop.png`), desktop);
      writeFileSync(join(BRUTOS, `${tela.id}-celular.png`), celular);
      writeFileSync(join(SAIDA, `${tela.id}.png`), await compoe(browser, desktop, celular));
    }
  } finally {
    await browser.close();
    await db.end();
  }
  console.log(`Pronto: ${SAIDA}`);
}

main().catch((erro) => {
  console.error(erro.message ?? erro);
  process.exit(1);
});
