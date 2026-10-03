const DIA_NO_VIVEIRO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Hoje no fuso do viveiro, `AAAA-MM-DD`. Não usar o `CURRENT_DATE` do banco: o
 * Neon roda em UTC, e depois das 21h ele já está no dia seguinte.
 */
export function hojeNoViveiro(now = new Date()): string {
  return DIA_NO_VIVEIRO.format(now);
}

export function isDataIso(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const data = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return data.toISOString().slice(0, 10) === text;
}

export function somaDias(iso: string, dias: number): string {
  const data = new Date(`${iso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** 0 domingo, 6 sábado. Lido em UTC, como `somaDias`, para o fuso não deslocar o dia. */
function diaDaSemana(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/**
 * O dia de carregar é o dia útil anterior à entrega: entrega na segunda se
 * carrega na sexta, porque ninguém vem no fim de semana para pôr muda no
 * caminhão.
 *
 * **Feriado fica de fora de propósito.** Os municipais variam de cidade para
 * cidade, e um calendário de feriados errado atrasaria o carregamento sem
 * ninguém entender por quê. Enquanto não houver cadastro deles, é melhor o
 * sistema marcar um dia útil que a pessoa corrige do que inventar um que ela
 * não esperava.
 */
export function diaUtilAnterior(iso: string): string {
  let dia = somaDias(iso, -1);
  while (diaDaSemana(dia) === 0 || diaDaSemana(dia) === 6) dia = somaDias(dia, -1);
  return dia;
}

/** 2026-09-14 → 14/09/2026. */
export function formatData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
