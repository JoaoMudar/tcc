// Confere os mapas de rotina de `docs/rotinas/img/` em duas frentes.
//
// 1. LEGIBILIDADE. Mesmo criterio de `mede-figuras.mjs`: a fonte util e o tamanho que
//    o rotulo assume ao encaixar a figura na mancha de 16 x 24 cm, e abaixo de 6 pt
//    nao se le impresso. E a conta que mostrou que o mapa consolidado chegava ao Word
//    a 5,2 pt, porque um `flowchart LR` de cinco caixas largas vira uma tira.
//
// 2. SEM CONTAGEM DE OBRA. Os nos deste conjunto ja trouxeram a fracao de etapas com
//    tela ("6 de 9", "nenhuma das 10 etapas"). Isso saiu: quantas telas ja existem e
//    andamento de desenvolvimento, nao conteudo de figura de TCC, e a fracao dentro do
//    desenho envelhecia sozinha. Ja envelheceu duas vezes: a auditoria registra os
//    mapas parados em "4 de 6" depois de a tabela crescer, e a Producao anunciando 8
//    etapas com a tabela ja em 10. Quem quiser o numero le a tabela de etapas da area
//    em `00-mapa-de-rotinas.md`; o status de cada area continua no traco da borda.
//    Esta verificacao existe para a fracao nao voltar sem que ninguem note.
//
//   node scripts/confere-mapas.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { leia } from './leia.mjs';

const IMG = 'docs/rotinas/img';

const ESCALA = 3; // o `-s 3` do render-mapas
const FONTE_BASE_PT = 12; // o rotulo do Mermaid, 16 px a 96 dpi
const PISO_PT = 6;
const MANCHA_MM = { largura: 160, altura: 240 };
const PX_PARA_MM = 25.4 / 96;

// ------------------------------------------------------- a fracao que nao pode voltar
// "6 de 9" · "nenhuma das 10 etapas" · "as 3 etapas"
function fracaoDeclarada(texto) {
  const m =
    texto.match(/\b\d+\s+de\s+\d+\b/) ||
    texto.match(/\bdas\s+\d+\s+etapas\b/) ||
    texto.match(/\bas\s+\d+\s+etapas\b/);
  return m ? m[0] : null;
}

function contagens(arquivo) {
  const achados = [];
  for (const linha of leia(`${IMG}/${arquivo}`).split('\n')) {
    if (/^\s*%%/.test(linha)) continue;
    const no = linha.match(/^\s*(\w+)\["(.+)"\]\s*$/);
    if (!no) continue;
    const texto = no[2].replace(/<[^>]+>/g, ' ');
    const fracao = fracaoDeclarada(texto);
    if (fracao) achados.push({ no: no[1], fracao });
  }
  return achados;
}

// ------------------------------------------------------- a fonte util
function dimensoes(caminho) {
  const buf = readFileSync(caminho);
  if (buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${caminho} nao parece PNG`);
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
}

const problemas = [];

console.log('=== Fonte util na mancha de 16 x 24 cm ===');
console.log('  figura              px            cm         retrato  paisagem   dpi');
for (const arquivo of readdirSync(IMG).filter((f) => f.endsWith('.png')).sort()) {
  const { largura, altura } = dimensoes(`${IMG}/${arquivo}`);
  const lMm = (largura / ESCALA) * PX_PARA_MM;
  const aMm = (altura / ESCALA) * PX_PARA_MM;
  const encaixe = (m) => Math.min(m.largura / lMm, m.altura / aMm);
  const retrato = FONTE_BASE_PT * encaixe(MANCHA_MM);
  const paisagem = FONTE_BASE_PT * encaixe({ largura: MANCHA_MM.altura, altura: MANCHA_MM.largura });
  // A imagem tem ESCALA vezes os pixels do tamanho natural, entao a resolucao
  // impressa e 96 x ESCALA dividido pelo fator de encaixe.
  const dpi = (96 * ESCALA) / encaixe(MANCHA_MM);
  const nome = arquivo.replace('.png', '');
  const marca = retrato < PISO_PT ? (paisagem < PISO_PT ? 'ERRO' : 'girar') : 'ok  ';
  console.log(
    `  ${marca} ${nome.padEnd(17)} ${`${largura}x${altura}`.padEnd(13)} ` +
      `${`${(lMm / 10).toFixed(1)}x${(aMm / 10).toFixed(1)}`.padEnd(10)} ` +
      `${retrato.toFixed(1).padStart(5)} pt ${paisagem.toFixed(1).padStart(6)} pt ${dpi.toFixed(0).padStart(5)}`
  );
  if (retrato < PISO_PT && paisagem < PISO_PT) {
    problemas.push(`${nome}: ${retrato.toFixed(1)} pt em retrato e ${paisagem.toFixed(1)} pt em paisagem, abaixo do piso de ${PISO_PT} pt`);
  }
}

console.log('\n=== Contagem de etapas dentro dos nos: nao deve haver nenhuma ===');
for (const arquivo of readdirSync(IMG).filter((f) => f.endsWith('.mmd')).sort()) {
  const achados = contagens(arquivo);
  console.log(`  ${achados.length ? 'ERRO' : 'ok  '} ${arquivo}`);
  for (const a of achados) {
    problemas.push(`${arquivo}: o no ${a.no} voltou a contar telas ("${a.fracao}"); o numero mora na tabela de etapas da pagina`);
  }
}

if (!problemas.length) {
  console.log('\nTodos os mapas se leem impressos, e nenhum conta telas dentro da figura.');
  process.exit(0);
}
console.log('\n=== Problemas ===');
for (const p of problemas) console.log(`  ${p}`);
process.exit(1);
