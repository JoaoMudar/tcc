// Lógica pura do `carga-ficticia.ts`, separada para teste: a trava que decide em
// qual banco a carga pode escrever, e a rotina de datas que a monta relativa a hoje.

/** O único banco que recebe dado inventado: a cópia local do Neon. */
export const BANCO_PERMITIDO = 'viveiro_espelho';

/** Hosts aceitos. Produção mora no Neon, e dado fictício lá viraria dado da empresa. */
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Prefixo do id das pessoas fictícias. É a marca da carga: a remoção parte delas,
 * e sem elas o banco é tratado como não carregado.
 */
export const PREFIXO_FICTICIO = 'f1c71c10-0000-4000-8000-';

/** O id de uma pessoa fictícia, pelo número dela. */
export function idFicticio(numero) {
  return `${PREFIXO_FICTICIO}${String(numero).padStart(12, '0')}`;
}

/** Devolve o motivo da recusa, ou null quando a URL é a do banco permitido. */
export function motivoDaRecusa(databaseUrl) {
  if (!databaseUrl) return 'DATABASE_URL não definida.';
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    return 'DATABASE_URL inválida.';
  }
  if (!HOSTS_LOCAIS.has(url.hostname)) return `o host "${url.hostname}" não é local; a carga só roda na cópia local.`;
  const banco = url.pathname.replace(/^\//, '');
  if (banco !== BANCO_PERMITIDO) return `o banco "${banco}" não é o ${BANCO_PERMITIDO}.`;
  return null;
}

/**
 * Decide o que fazer com o que já está no banco. A produção do espelho nasce vazia:
 * registro de produção sem a marca da carga é dado real, e a carga não mistura nem apaga.
 */
export function motivoParaNaoMexer({ producao, ficticias }) {
  if (producao > 0 && ficticias === 0) {
    return `há ${producao} registro(s) de produção sem a marca da carga fictícia. Eles parecem reais, e nada foi alterado.`;
  }
  return null;
}

/** Soma dias a uma data `AAAA-MM-DD`, em UTC para o fuso não mudar o dia. */
export function somaDias(iso, dias) {
  const data = new Date(`${iso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** A segunda-feira da semana da data. O domingo pertence à semana que termina nele. */
export function segundaDaSemana(iso) {
  const dia = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return somaDias(iso, dia === 0 ? -6 : 1 - dia);
}

/**
 * A soma dos movimentos tem de reproduzir o saldo (RF-28). Devolve os lotes em que
 * não reproduz: a carga termina com esta lista vazia, ou falha.
 */
export function lotesComSaldoDivergente(linhas) {
  return linhas.filter((l) => Number(l.saldo) !== Number(l.soma)).map((l) => l.codigo);
}

/** Compara a situação esperada de cada lote com a da visão. Devolve as divergências, em texto. */
export function situacoesDivergentes(esperadas, obtidas) {
  const porCodigo = new Map(obtidas.map((o) => [o.codigo, o.situacao]));
  return esperadas
    .filter((e) => porCodigo.get(e.codigo) !== e.situacao)
    .map((e) => `${e.codigo} (${e.nome}): esperava ${e.situacao}, a visão diz ${porCodigo.get(e.codigo) ?? 'nada'}`);
}
