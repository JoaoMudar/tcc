// Leitura de artefato para os geradores, normalizando a quebra de linha.
//
// POR QUE ISTO EXISTE, e nao um `readFileSync` direto em cada script.
//
// Os geradores partem o arquivo em linhas e casam cada uma contra uma regex
// ancorada no fim (`...(.*)$`). Num checkout com quebra de linha do Windows,
// sobra um retorno de carro no fim de cada linha depois da divisao, e em
// JavaScript o `.` de uma regex **nao casa retorno de carro**: e um terminador
// de linha para a linguagem, como a propria quebra.
//
// O efeito nao e erro, e pior: a regex simplesmente nao casa nada, o gerador
// conclui que o documento nao tem requisito nenhum e **grava a tabela vazia**,
// sem reclamar. Foi assim que as secoes derivadas deste projeto se apagaram de
// uma vez so, e o unico sinal foi a linha "B3: 0 RF, 0 RNF, 0 RN" no terminal.
//
// A funcao existe para que essa correcao seja uma so, e nao quatro copias que
// divergem no dia em que a quinta for escrita.

import { readFileSync } from 'node:fs';

const CRLF = new RegExp(String.fromCharCode(13) + String.fromCharCode(10), 'g');
const LF = String.fromCharCode(10);

export function leia(caminho) {
  return readFileSync(caminho, 'utf8').replace(CRLF, LF);
}
