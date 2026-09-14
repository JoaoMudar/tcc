const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Data e hora no fuso do viveiro, qualquer que seja o fuso do servidor. Ex.: 14/09/2026 07:15. */
export function formatDateTime(date: Date): string {
  return DATE_TIME.format(date).replace(',', '');
}
