/**
 * Nomes populares de espécie, comparados como quem digita os escreve: sem SQL e
 * sem `pg` (RNF-11, TA-60), porque o reconhecimento da lista colada roda no
 * navegador e o cadastro roda no servidor, e os dois precisam concordar.
 */
import { normalizeTexto } from './busca-opcoes';

/**
 * A forma canônica do nome: sem acento, minúsculo, e hífen, barra e sublinhado
 * viram espaço. "Ipê-Amarelo" e "ipe amarelo" são o mesmo nome, e no viveiro
 * eles aparecem escritos das duas maneiras no mesmo dia.
 */
export function normalizeNomePopular(texto: string): string {
  return normalizeTexto(texto)
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface NomeConhecido {
  especieId: string;
  nome: string;
  /** Como a espécie dona aparece na tela, para a recusa dizer de quem é o nome. */
  especie: string;
}

/**
 * RN-01: **um nome popular pertence a uma espécie só.** Devolve o nome que já
 * existe, quando o candidato colidir com outra espécie, e `null` quando ele
 * está livre.
 *
 * A garantia é do aplicativo, e não do banco: `especies_nomes_populares` só tem
 * único por (espécie, nome), e um índice global exigiria coluna normalizada.
 * Com três pessoas usando o sistema, duas gravações do mesmo nome no mesmo
 * instante não é o risco que justifica a migration.
 */
export function achaConflitoDeNome(
  candidato: string,
  conhecidos: readonly NomeConhecido[],
  exceto?: string,
): NomeConhecido | null {
  const alvo = normalizeNomePopular(candidato);
  if (!alvo) return null;
  for (const conhecido of conhecidos) {
    if (exceto && conhecido.especieId === exceto) continue;
    if (normalizeNomePopular(conhecido.nome) === alvo) return conhecido;
  }
  return null;
}
