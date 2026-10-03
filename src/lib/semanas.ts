import { formatData, isDataIso, somaDias } from './datas';

/**
 * A semana da agenda (RF-26): começa na segunda e vai até o domingo, que
 * também aceita tarefa. Datas sempre `AAAA-MM-DD`, contadas em UTC para o fuso do
 * servidor não mudar o dia.
 */

const NOMES_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;
const SIGLAS_DIA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const;

function diaDaSemana(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** A segunda-feira da semana da data. O domingo pertence à semana que termina nele. */
export function inicioDaSemana(iso: string): string {
  const dia = diaDaSemana(iso);
  return somaDias(iso, dia === 0 ? -6 : 1 - dia);
}

/** `semana` da URL: vale se for data; qualquer dia leva à segunda da sua semana. */
export function lerSemana(texto: string | undefined, hoje: string): string {
  return inicioDaSemana(texto && isDataIso(texto) ? texto : hoje);
}

/** É data válida e é segunda-feira. */
export function isInicioDeSemana(texto: string): boolean {
  return isDataIso(texto) && inicioDaSemana(texto) === texto;
}

/** Segunda a domingo. */
export function diasDaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, i) => somaDias(inicio, i));
}

/**
 * Segunda a sexta: é o que a grade de tela larga desenha no zoom Semana (RNF-14).
 * Sábado e domingo aparecem nos zooms 3 dias e Dia, no celular e no formulário.
 */
export function diasUteisDaSemana(inicio: string): string[] {
  return Array.from({ length: 5 }, (_, i) => somaDias(inicio, i));
}

export function nomeDia(iso: string): string {
  return NOMES_DIA[diaDaSemana(iso)];
}

export function siglaDia(iso: string): string {
  return SIGLAS_DIA[diaDaSemana(iso)];
}

/** 2026-09-14 → 14/09. */
export function diaMes(iso: string): string {
  return formatData(iso).slice(0, 5);
}

/** "07/09 a 13/09". */
export function rotuloSemana(inicio: string): string {
  return `${diaMes(inicio)} a ${diaMes(somaDias(inicio, 6))}`;
}
