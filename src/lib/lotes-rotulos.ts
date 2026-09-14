/**
 * Rótulos e contas das telas de lote que o navegador pode receber: sem SQL e sem
 * `pg` (RNF-11, TA-60). O servidor usa os mesmos, pelas reexportações de
 * `lotes.ts` e `movimentos.ts`.
 */

/** Lista fechada do C8. `encerrado` só a porta de movimentos põe. */
export const FASES = {
  semeado: 'Semeado',
  germinado: 'Germinado',
  repicado: 'Repicado',
  crescimento: 'Crescimento',
  rustificacao: 'Rustificação',
  pronto: 'Pronto',
  encerrado: 'Encerrado',
} as const;

export type Fase = keyof typeof FASES;

export const FASES_EDITAVEIS = (Object.keys(FASES) as Fase[]).filter((fase) => fase !== 'encerrado');

/** Lista fechada do RN-10. Texto livre não vira estatística por causa. */
export const CAUSAS_PERDA = {
  seca: 'Seca',
  praga: 'Praga',
  geada: 'Geada',
  manuseio: 'Manuseio',
  outro: 'Outro',
} as const;

export type CausaPerda = keyof typeof CAUSAS_PERDA;

export function isCausaPerda(value: string): value is CausaPerda {
  return Object.hasOwn(CAUSAS_PERDA, value);
}

export const TIPOS_MOVIMENTO = {
  entrada: 'Entrada',
  perda: 'Perda',
  repicagem_saida: 'Saída por repicagem',
  repicagem_entrada: 'Entrada por repicagem',
  venda: 'Venda',
  ajuste_contagem: 'Ajuste de contagem',
  transferencia: 'Transferência de canteiro',
} as const;

export type TipoMovimento = keyof typeof TIPOS_MOVIMENTO;

const NUMERO = new Intl.NumberFormat('pt-BR');

export function formatQuantidade(quantidade: number): string {
  return NUMERO.format(quantidade);
}

/** "6000" ou "6.000" viram 6000; o resto é `null`. No celular, quem digita separa o milhar. */
export function lerQuantidade(text: string): number | null {
  const texto = text.trim().replace(/\s/g, '');
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(texto)) return null;
  const numero = Number(texto.replace(/\./g, ''));
  return Number.isSafeInteger(numero) ? numero : null;
}

export function canteiroLabel(letra: string, numero: number): string {
  return `${letra}-${numero}`;
}

export interface CanteiroResumo {
  id: string;
  areaId: string;
  letra: string;
  numero: number;
  capacidade: number | null;
  lotes: number;
  mudas: number;
}

/** RN-29: a capacidade avisa e não recusa. `null` quando cabe ou quando o canteiro não tem capacidade. */
export function avisoCapacidade(canteiro: CanteiroResumo, quantidade: number): string | null {
  if (canteiro.capacidade === null || canteiro.mudas + quantidade <= canteiro.capacidade) return null;
  const label = canteiroLabel(canteiro.letra, canteiro.numero);
  const ja =
    canteiro.lotes === 0
      ? `O canteiro ${label} está vazio`
      : `O canteiro ${label} já tem ${canteiro.lotes} ${canteiro.lotes === 1 ? 'lote' : 'lotes'} e ${formatQuantidade(canteiro.mudas)} mudas`;
  return (
    `${ja}, para uma capacidade de ${formatQuantidade(canteiro.capacidade)}. ` +
    `Com este lote passa a ${formatQuantidade(canteiro.mudas + quantidade)}. O aviso não impede criar.`
  );
}
