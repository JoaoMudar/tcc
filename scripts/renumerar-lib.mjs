// Peças puras da renumeração, separadas de scripts/renumerar.mjs para poderem ser testadas.

export const IDENTIFICADOR = /\b(RNF|RF|RN|UC|TA)-(\d+)\b/g;

// Lê o de-para oficial (tipo,antigo,novo,situacao,observacao). A linha excluída
// não tem destino: ela entra em `excluidos`, e não no mapa.
export function lerMapaCsv(texto) {
  const mapa = new Map();
  const excluidos = new Set();
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const [cabecalho, ...dados] = linhas;
  if (!/^tipo,antigo,novo,situacao/.test(cabecalho)) {
    throw new Error(`cabeçalho inesperado no mapa: ${cabecalho}`);
  }
  for (const linha of dados) {
    const [, antigo, novo, situacao] = linha.split(',').map((c) => c.trim());
    if (situacao === 'excluida') {
      excluidos.add(antigo);
      continue;
    }
    if (!novo) throw new Error(`linha sem código novo e não excluída: ${linha}`);
    if (mapa.has(antigo)) throw new Error(`código antigo repetido no mapa: ${antigo}`);
    mapa.set(antigo, novo);
  }
  const destinos = [...mapa.values()];
  const repetido = destinos.find((d, i) => destinos.indexOf(d) !== i);
  if (repetido) throw new Error(`dois códigos antigos vão para ${repetido}`);
  return { mapa, excluidos };
}

// "RF-22 a RF-25": a faixa precisa ser trocada inteira, porque os membros dela
// não continuam vizinhos depois da renumeração.
const FAIXA = /\b(RNF|RF|RN)-(\d+) (a|até) \1-(\d+)\b/;
const TROCAVEL = new RegExp(`${FAIXA.source}|${IDENTIFICADOR.source}`, 'g');

const numero = (codigo) => Number(codigo.split('-')[1]);

// Lista os códigos em ordem, juntando três ou mais seguidos em faixa:
// RF-01, RF-02, RF-03, RF-05, RF-06 -> "RF-01 a RF-03, RF-05, RF-06". Só vírgula,
// porque a faixa costuma estar no meio de uma lista maior.
export function comporFaixa(codigos, conectivo = 'a') {
  const ordenados = [...codigos].sort((x, y) => numero(x) - numero(y));
  const partes = [];
  for (let i = 0; i < ordenados.length; ) {
    let j = i;
    while (j + 1 < ordenados.length && numero(ordenados[j + 1]) === numero(ordenados[j]) + 1) j++;
    if (j - i >= 2) partes.push(`${ordenados[i]} ${conectivo} ${ordenados[j]}`);
    else for (let k = i; k <= j; k++) partes.push(ordenados[k]);
    i = j + 1;
  }
  return partes.join(', ');
}

function trocarFaixa(todo, familia, inicio, conectivo, fim, mapa) {
  const membros = [...mapa.keys()].filter((c) => {
    if (c.split('-')[0] !== familia) return false;
    const n = numero(c);
    return n >= Number(inicio) && n <= Number(fim);
  });
  if (!mapa.has(`${familia}-${inicio}`) || !mapa.has(`${familia}-${fim}`) || !membros.length) {
    return todo.replace(new RegExp(IDENTIFICADOR.source, 'g'), (c) => mapa.get(c) ?? c);
  }
  return comporFaixa(membros.map((c) => mapa.get(c)), conectivo);
}

// Troca numa passada só: o replace não relê o que acabou de escrever, e por isso
// RN-10 -> RN-19 seguido de RN-19 -> RN-14 não leva a antiga RN-10 até RN-14. A
// versão anterior marcava o trocado com um sentinela NUL e depois apagava todo NUL
// do arquivo, inclusive o que já existia nele (scripts/scan-secrets.mjs tem um).
export function trocar(texto, mapa) {
  return texto.replace(TROCAVEL, (todo, familia, inicio, conectivo, fim) => {
    if (familia) return trocarFaixa(todo, familia, inicio, conectivo, fim, mapa);
    return mapa.get(todo) ?? todo;
  });
}

// Identificadores excluídos ainda citados no texto.
export function excluidosCitados(texto, excluidos) {
  const achados = new Set();
  for (const [todo] of texto.matchAll(IDENTIFICADOR)) if (excluidos.has(todo)) achados.add(todo);
  return [...achados];
}
