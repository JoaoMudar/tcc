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

/** 2026-09-14 → 14/09/2026. */
export function formatData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
