// Mede a "fonte útil" de cada figura do modelo-dados-pt.
//
// Fonte útil é o tamanho que o texto assume ao encaixar a figura na mancha de
// 16 x 24 cm, limitado pela largura ou pela altura, o que apertar primeiro. Abaixo
// de 6 pt não se lê impresso, e é o critério que decide se a figura precisa ser
// dividida ou girada.
//
// As figuras são renderizadas a -s 3, então a dimensão natural é a do PNG dividida
// por três. O Mermaid desenha o rótulo a 16 px, que a 96 dpi são 12 pt.
//
//   node scripts/mede-figuras.mjs

import { readFileSync, readdirSync } from 'node:fs';

const DIR = 'docs/engenharia/modelo-dados-pt/img';
const ESCALA = 3;
const FONTE_BASE_PT = 12;
const MANCHA_MM = { largura: 160, altura: 240 };
const PX_PARA_MM = 25.4 / 96;

// Lê largura e altura do cabeçalho IHDR de um PNG.
function dimensoes(caminho) {
  const buf = readFileSync(caminho);
  if (buf.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`${caminho} nao parece PNG`);
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
}

function fonteUtil(larguraMm, alturaMm, mancha) {
  const escala = Math.min(mancha.largura / larguraMm, mancha.altura / alturaMm);
  return FONTE_BASE_PT * escala;
}

const linhas = [];
for (const arquivo of readdirSync(DIR).filter((f) => f.endsWith('.png')).sort()) {
  const { largura, altura } = dimensoes(`${DIR}/${arquivo}`);
  const larguraMm = (largura / ESCALA) * PX_PARA_MM;
  const alturaMm = (altura / ESCALA) * PX_PARA_MM;

  const retrato = fonteUtil(larguraMm, alturaMm, MANCHA_MM);
  const paisagem = fonteUtil(larguraMm, alturaMm, { largura: MANCHA_MM.altura, altura: MANCHA_MM.largura });

  linhas.push({
    figura: arquivo.replace('.png', ''),
    px: `${largura}x${altura}`,
    cm: `${(larguraMm / 10).toFixed(0)}x${(alturaMm / 10).toFixed(0)}`,
    retrato: retrato.toFixed(1),
    paisagem: paisagem.toFixed(1),
    girar: paisagem > retrato && retrato < 6,
  });
}

const largura = Math.max(...linhas.map((l) => l.figura.length));
console.log('figura'.padEnd(largura) + '  px            cm       retrato  paisagem');
for (const l of linhas) {
  console.log(
    l.figura.padEnd(largura) +
      '  ' + l.px.padEnd(13) +
      ' ' + l.cm.padEnd(8) +
      ' ' + l.retrato.padStart(7) + ' pt' +
      ' ' + l.paisagem.padStart(8) + ' pt' +
      (l.girar ? '  << usar paisagem' : '') +
      (Number(l.retrato) < 6 && !l.girar ? '  << ABAIXO DO PISO' : '')
  );
}
