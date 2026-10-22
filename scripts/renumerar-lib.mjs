// Peças puras da renumeração, separadas de scripts/renumerar.mjs para poderem ser testadas.

export const IDENTIFICADOR = /\b(RNF|RF|RN|UC|TA)-(\d+)\b/g;

// Marca o identificador já trocado. Não pode aparecer em texto de verdade.
const SENTINELA = '\u0000';

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

// Troca em duas passadas: a primeira marca cada identificador já trocado com o
// sentinela, e só a segunda o tira. Sem isso, RN-10 -> RN-19 seguido de
// RN-19 -> RN-14 levaria a antiga RN-10 até RN-14.
export function trocar(texto, mapa) {
  const marcado = texto.replace(IDENTIFICADOR, (todo) => {
    const novo = mapa.get(todo);
    return novo ? SENTINELA + novo + SENTINELA : todo;
  });
  return marcado.split(SENTINELA).join('');
}

// Identificadores excluídos ainda citados no texto.
export function excluidosCitados(texto, excluidos) {
  const achados = new Set();
  for (const [todo] of texto.matchAll(IDENTIFICADOR)) if (excluidos.has(todo)) achados.add(todo);
  return [...achados];
}
