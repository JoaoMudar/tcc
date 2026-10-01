import { type Turno, parseHora } from './turnos';

/**
 * A geometria da agenda da semana em tela larga (RNF-14): o dia vira eixo de hora
 * real, e a barra ocupa o intervalo dela dentro desse eixo.
 *
 * Fica separada do componente de propósito, sem React nem DOM, porque é aqui que
 * o arrasto pode ser testado: o hook só converte pixel em minuto e chama estas
 * funções.
 *
 * O turno continua sendo a unidade do planejamento (RN-12). Quem não tem hora
 * declarada desenha ocupando a janela do próprio turno, e é o arrasto que torna
 * a hora explícita.
 */

/** Minutos desde a meia-noite. */
export interface Janela {
  inicio: number;
  fim: number;
}

/**
 * O eixo do dia na grade larga: a janela e os vãos entre turnos (o almoço), que
 * não ocupam largura. Quem não informa vão tem o eixo proporcional de sempre.
 */
export interface Eixo extends Janela {
  vaos?: readonly Janela[];
}

export interface Faixa extends Janela {
  /** O fim mostrado foi inferido, e não declarado (RN-12). */
  derivada: boolean;
}

export type Borda = 'inicio' | 'fim';

/** O arrasto anda de quinze em quinze minutos: o viveiro não planeja no minuto. */
export const PASSO_MINUTOS = 15;
/** Abaixo disto a barra deixa de ser clicável, e a tarefa deixa de ser legível. */
export const DURACAO_MINIMA = 30;
/** Quanto dura, no desenho, a tarefa que declarou só o início (RN-12). */
export const DURACAO_PADRAO = 60;

/** Só quando não há turno nenhum em uso: a página não chega a desenhar a grade. */
const JANELA_PADRAO: Janela = { inicio: 7 * 60, fim: 17 * 60 };

function minutosDoTurno(turno: Pick<Turno, 'inicio' | 'fim'>): Janela | null {
  const inicio = parseHora(turno.inicio);
  const fim = parseHora(turno.fim);
  if (inicio === null || fim === null || fim <= inicio) return null;
  return { inicio, fim };
}

function janelasAtivas(turnos: readonly Turno[]): Janela[] {
  return turnos
    .filter((turno) => turno.ativo)
    .map(minutosDoTurno)
    .filter((janela): janela is Janela => janela !== null)
    .sort((um, outro) => um.inicio - outro.inicio);
}

/**
 * Do começo do primeiro turno ao fim do último, e os vãos entre eles: o almoço
 * vira um divisor, e não largura sem conteúdo.
 */
export function janelaDoDia(turnos: readonly Turno[]): Eixo {
  const janelas = janelasAtivas(turnos);
  if (janelas.length === 0) return { ...JANELA_PADRAO, vaos: [] };
  const vaos: Janela[] = [];
  let cursor = janelas[0].fim;
  for (const janela of janelas.slice(1)) {
    if (janela.inicio > cursor) vaos.push({ inicio: cursor, fim: janela.inicio });
    cursor = Math.max(cursor, janela.fim);
  }
  return { inicio: janelas[0].inicio, fim: cursor, vaos };
}

/** As bordas da jornada (07:30, 12:00, 13:30, 18:00), onde o arrasto se imanta. */
export function ancorasDaJornada(turnos: readonly Turno[]): number[] {
  return [...new Set(janelasAtivas(turnos).flatMap((janela) => [janela.inicio, janela.fim]))].sort((a, b) => a - b);
}

/** Até quantos minutos de uma borda da jornada o arrasto encaixa nela. */
export const RAIO_IMA = 10;

/** A âncora a menos de `raio` minutos, ou `null`. */
export function ancoraProxima(minuto: number, ancoras: readonly number[], raio: number = RAIO_IMA): number | null {
  let melhor: number | null = null;
  for (const ancora of ancoras) {
    const distancia = Math.abs(ancora - minuto);
    if (distancia < raio && (melhor === null || distancia < Math.abs(melhor - minuto))) melhor = ancora;
  }
  return melhor;
}

function janelaDoTurno(turnoId: string, turnos: readonly Turno[]): Janela {
  const turno = turnos.find((candidato) => candidato.id === turnoId);
  if (turno) {
    const janela = minutosDoTurno(turno);
    if (janela) return janela;
  }
  const { inicio, fim } = janelaDoDia(turnos);
  return { inicio, fim };
}

/** O mínimo que a barra precisa saber de si: o resto do resumo não entra na geometria. */
export interface TarefaComHorario {
  turnoId: string;
  horaInicio: string | null;
  horaFim: string | null;
}

/**
 * Os três casos que a `20260901000008` admite: sem hora (desenha o turno
 * inteiro), só início (desenha a duração padrão) e início com fim (desenha o que
 * foi declarado).
 */
export function faixaDaBarra(tarefa: TarefaComHorario, turnos: readonly Turno[]): Faixa {
  const doTurno = janelaDoTurno(tarefa.turnoId, turnos);
  const inicio = tarefa.horaInicio === null ? null : parseHora(tarefa.horaInicio);
  if (inicio === null) return { ...doTurno, derivada: true };

  const fim = tarefa.horaFim === null ? null : parseHora(tarefa.horaFim);
  if (fim === null || fim <= inicio) {
    const limite = Math.max(doTurno.fim, inicio + DURACAO_MINIMA);
    return { inicio, fim: Math.min(inicio + DURACAO_PADRAO, limite), derivada: true };
  }
  return { inicio, fim, derivada: false };
}

/** Recorta a faixa no eixo do dia, preservando ao menos um minuto de largura. */
export function limitaNaJanela(faixa: Faixa, janela: Janela): Faixa {
  const inicio = Math.min(Math.max(faixa.inicio, janela.inicio), janela.fim - 1);
  const fim = Math.max(Math.min(faixa.fim, janela.fim), inicio + 1);
  return { ...faixa, inicio, fim };
}

/** Minutos de eixo útil do começo da janela até o minuto: o vão não conta. */
function minutosUteis(minuto: number, eixo: Eixo): number {
  let uteis = minuto - eixo.inicio;
  for (const vao of eixo.vaos ?? []) uteis -= Math.max(0, Math.min(minuto, vao.fim) - vao.inicio);
  return uteis;
}

/** O tamanho da faixa no eixo, sem o pedaço que cai fora da janela ou no vão. */
export function duracaoUtil(faixa: Janela, eixo: Eixo): number {
  const recortada = limitaNaJanela({ ...faixa, derivada: false }, eixo);
  return minutosUteis(recortada.fim, eixo) - minutosUteis(recortada.inicio, eixo);
}

/** Onde o minuto cai no eixo do dia, de 0 a 100. Dentro do vão, cai no divisor. */
export function percentualDoMinuto(minuto: number, eixo: Eixo): number {
  const total = Math.max(1, minutosUteis(eixo.fim, eixo));
  return (minutosUteis(minuto, eixo) / total) * 100;
}

/** Em porcentagem, porque a coluna do dia muda de largura com a janela do navegador. */
export function posicaoPercentual(faixa: Faixa, janela: Eixo): { left: number; width: number } {
  const recortada = limitaNaJanela(faixa, janela);
  const left = percentualDoMinuto(recortada.inicio, janela);
  return { left, width: percentualDoMinuto(recortada.fim, janela) - left };
}

/**
 * As horas cheias dentro da janela, que a grade desenha como linha e o
 * cabeçalho numera: sem elas o eixo tem só as listras de turno, e a barra não
 * diz a olho se começa às oito ou às nove. A hora que cai dentro do vão não tem
 * onde ficar e sai. `pares` deixa só as horas pares longe da borda direita: é a
 * régua do dia fora de foco, onde não cabe um número por hora.
 */
export function marcasDeHora(eixo: Eixo, { pares = false }: { pares?: boolean } = {}): number[] {
  const primeira = Math.ceil(eixo.inicio / 60) * 60;
  const marcas: number[] = [];
  for (let minuto = primeira; minuto <= eixo.fim; minuto += 60) {
    if ((eixo.vaos ?? []).some((vao) => minuto > vao.inicio && minuto < vao.fim)) continue;
    if (pares && (minuto % 120 !== 0 || minuto === eixo.fim)) continue;
    marcas.push(minuto);
  }
  return marcas;
}

/** A fração horizontal da coluna vira minuto do dia. Passado o divisor, já é o turno seguinte. */
export function minutoNaPosicao(fracao: number, eixo: Eixo): number {
  const limitada = Math.min(Math.max(fracao, 0), 1);
  let minuto = eixo.inicio + limitada * minutosUteis(eixo.fim, eixo);
  for (const vao of [...(eixo.vaos ?? [])].sort((a, b) => a.inicio - b.inicio)) {
    if (minuto > vao.inicio) minuto += vao.fim - vao.inicio;
  }
  return Math.min(Math.max(minuto, eixo.inicio), eixo.fim);
}

export function arredondaPasso(minuto: number, passo: number = PASSO_MINUTOS): number {
  return Math.round(minuto / passo) * passo;
}

/**
 * O turno que contém o minuto, ou `null`. Os turnos não cobrem o dia inteiro: às
 * 13h pode não haver turno nenhum, e por isso a hora sozinha não diz a qual
 * turno a tarefa pertence. Quem chama cai no turno da faixa onde soltou.
 */
export function turnoDoMinuto(minuto: number, turnos: readonly Turno[]): Turno | null {
  for (const turno of turnos) {
    const janela = minutosDoTurno(turno);
    if (janela && minuto >= janela.inicio && minuto < janela.fim) return turno;
  }
  return null;
}

/**
 * O turno que a tarefa passa a ter depois do arrasto. Dentro de um turno, é ele.
 * No vão entre dois, é o turno seguinte: quem solta a barra às 12h30 está
 * mirando a tarde, e o turno nunca pode ficar vazio (RN-12).
 */
export function turnoParaMinuto(minuto: number, turnos: readonly Turno[]): Turno | null {
  const dentro = turnoDoMinuto(minuto, turnos);
  if (dentro) return dentro;
  const ordenados = turnos
    .map((turno) => ({ turno, janela: minutosDoTurno(turno) }))
    .filter((par): par is { turno: Turno; janela: Janela } => par.janela !== null)
    .sort((um, outro) => um.janela.inicio - outro.janela.inicio);
  if (ordenados.length === 0) return null;
  return (ordenados.find((par) => par.janela.inicio >= minuto) ?? ordenados[ordenados.length - 1]).turno;
}

/** O minuto encaixado: na borda da jornada, se está perto dela; senão, no passo. */
function encaixar(minuto: number, ancoras: readonly number[]): number {
  return ancoraProxima(minuto, ancoras) ?? arredondaPasso(minuto);
}

/**
 * Arrastar o corpo: a duração não muda, e a barra não sai do eixo do dia. Com
 * `ancoras`, o início ou o fim que passa perto de uma borda da jornada encaixa nela.
 */
export function moverFaixa(faixa: Faixa, deltaMinutos: number, janela: Janela, ancoras: readonly number[] = []): Faixa {
  const duracao = faixa.fim - faixa.inicio;
  const bruto = faixa.inicio + deltaMinutos;
  const peloInicio = ancoraProxima(bruto, ancoras);
  const peloFim = ancoraProxima(bruto + duracao, ancoras);
  const desejado = peloInicio ?? (peloFim === null ? arredondaPasso(bruto) : peloFim - duracao);
  const inicio = Math.min(Math.max(desejado, janela.inicio), janela.fim - duracao);
  return { inicio, fim: inicio + duracao, derivada: false };
}

/** Arrastar a borda: o outro lado fica parado, e a duração mínima é respeitada. */
export function redimensionarFaixa(faixa: Faixa, borda: Borda, deltaMinutos: number, janela: Janela, ancoras: readonly number[] = []): Faixa {
  if (borda === 'inicio') {
    const inicio = Math.min(Math.max(encaixar(faixa.inicio + deltaMinutos, ancoras), janela.inicio), faixa.fim - DURACAO_MINIMA);
    return { inicio, fim: faixa.fim, derivada: false };
  }
  const fim = Math.max(Math.min(encaixar(faixa.fim + deltaMinutos, ancoras), janela.fim), faixa.inicio + DURACAO_MINIMA);
  return { inicio: faixa.inicio, fim, derivada: false };
}

/** 450 → "07:30", que é o formato que a ação e o `time` do Postgres esperam. */
export function formatMinuto(minuto: number): string {
  const total = ((Math.round(minuto) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface Trecho<T> {
  item: T;
  /** O pedaço que se desenha: a tarefa cruzada por outra sai em mais de um. */
  faixa: Faixa;
  /** A faixa inteira da tarefa, que é o que o arrasto move. */
  completa: Faixa;
  /** 0 é a principal, a faixa de cima; de 1 em diante, as secundárias embaixo dela. */
  camada: number;
  /** Quantas camadas aparecem no pedaço: 1 é a tarefa sozinha, na altura toda. */
  camadas: number;
  /** O trecho toca a borda real da tarefa: só aí a alça de duração aparece. */
  bordaInicio: boolean;
  bordaFim: boolean;
  /** Na última camada: as que também se cruzam ali e não cabem na altura. */
  ocultas: T[];
}

/** O que decide qual tarefa fica com a faixa de cima. */
export interface Precedencia {
  id: string;
  /** Quando a gerência escolheu esta como principal; nula segue a regra (RF-26). */
  prioridadeEm: string | null;
  faixa: Pick<Janela, 'inicio' | 'fim'>;
}

/**
 * A principal é a escolhida à mão (a escolha mais recente vence); sem escolha, a
 * de maior duração, e no empate a que começa primeiro. A curta vai para a faixa
 * estreita, onde o trecho cruzado é a tarefa inteira dela.
 */
export function comparaPrecedencia(um: Precedencia, outro: Precedencia): number {
  if (um.prioridadeEm !== outro.prioridadeEm) {
    if (um.prioridadeEm === null) return 1;
    if (outro.prioridadeEm === null) return -1;
    return um.prioridadeEm < outro.prioridadeEm ? 1 : -1;
  }
  const duracao = outro.faixa.fim - outro.faixa.inicio - (um.faixa.fim - um.faixa.inicio);
  if (duracao !== 0) return duracao;
  if (um.faixa.inicio !== outro.faixa.inicio) return um.faixa.inicio - outro.faixa.inicio;
  return um.id < outro.id ? -1 : um.id > outro.id ? 1 : 0;
}

/**
 * RF-26 admite mais de uma tarefa ao mesmo tempo, mas a linha da pessoa não
 * cresce: onde elas se cruzam, a primeira na precedência fica com a faixa de
 * cima e as outras dividem a de baixo, até `maxCamadas`. As que não cabem são
 * contadas na última camada. O corte é só do desenho: os horários não mudam.
 *
 * Corta o dia nos limites de todas as faixas e, em cada pedaço, distribui as
 * tarefas pela precedência; pedaços vizinhos com a mesma tarefa, na mesma
 * camada e com o mesmo número de camadas, se fundem.
 */
export function sobrepor<T>(
  itens: readonly T[],
  faixaDe: (item: T) => Faixa,
  compara: (um: T, outro: T) => number,
  maxCamadas: number = 2,
): Trecho<T>[] {
  const ordenados = itens.map((item) => ({ item, faixa: faixaDe(item) })).sort((um, outro) => compara(um.item, outro.item));
  const limites = [...new Set(ordenados.flatMap(({ faixa }) => [faixa.inicio, faixa.fim]))].sort((a, b) => a - b);

  const trechos: Trecho<T>[] = [];
  let abertos = new Map<number, Trecho<T>>();
  for (let i = 0; i < limites.length - 1; i++) {
    const inicio = limites[i];
    const fim = limites[i + 1];
    const cobrem = ordenados.filter(({ faixa }) => faixa.inicio <= inicio && faixa.fim >= fim);
    const camadas = Math.min(cobrem.length, Math.max(1, maxCamadas));
    const proximos = new Map<number, Trecho<T>>();
    for (let camada = 0; camada < camadas; camada++) {
      const quem = cobrem[camada];
      const ocultas = camada === camadas - 1 ? cobrem.slice(camadas).map(({ item }) => item) : [];
      const aberto = abertos.get(camada);
      const mesmasOcultas = aberto !== undefined && aberto.ocultas.length === ocultas.length && aberto.ocultas.every((o, k) => o === ocultas[k]);
      if (aberto && mesmasOcultas && aberto.item === quem.item && aberto.faixa.fim === inicio && aberto.camadas === camadas) {
        aberto.faixa = { ...aberto.faixa, fim };
        proximos.set(camada, aberto);
        continue;
      }
      const novo: Trecho<T> = {
        item: quem.item,
        faixa: { inicio, fim, derivada: quem.faixa.derivada },
        completa: quem.faixa,
        camada,
        camadas,
        bordaInicio: false,
        bordaFim: false,
        ocultas,
      };
      trechos.push(novo);
      proximos.set(camada, novo);
    }
    abertos = proximos;
  }
  return trechos.map((t) => ({ ...t, bordaInicio: t.faixa.inicio === t.completa.inicio, bordaFim: t.faixa.fim === t.completa.fim }));
}

/**
 * Quanto da jornada a pessoa tem no dia: a soma das tarefas no eixo útil. A
 * tarefa cruzada conta duas vezes, de propósito: é o que denuncia o excesso.
 */
export function ocupacaoDoDia(faixas: readonly Janela[], eixo: Eixo): number {
  return faixas.reduce((total, faixa) => total + duracaoUtil(faixa, eixo), 0);
}

export interface VaoParaLancar {
  turno: Turno;
  /** Nulas quando o turno está livre: a tarefa vale pelo turno inteiro (RN-12). */
  horaInicio: string | null;
  horaFim: string | null;
}

/**
 * O clique no vazio da grade: o turno vem do minuto (no vão entre turnos, o
 * seguinte), e, se o turno já tem tarefa, a hora é o pedaço livre dele onde se
 * clicou. Tarefa das 8h às 9h na manhã, clique à direita: das 9h ao fim da manhã.
 */
export function vaoParaLancar(minuto: number, turnos: readonly Turno[], ocupadas: readonly Pick<Faixa, 'inicio' | 'fim'>[]): VaoParaLancar | null {
  const turno = turnoParaMinuto(minuto, turnos.filter((t) => t.ativo));
  const doTurno = turno && minutosDoTurno(turno);
  if (!turno || !doTurno) return null;

  const dentro = ocupadas
    .map((f) => ({ inicio: Math.max(f.inicio, doTurno.inicio), fim: Math.min(f.fim, doTurno.fim) }))
    .filter((f) => f.fim > f.inicio)
    .sort((a, b) => a.inicio - b.inicio);
  const semHora = { turno, horaInicio: null, horaFim: null };
  if (dentro.length === 0) return semHora;

  const vaos: Janela[] = [];
  let cursor = doTurno.inicio;
  for (const f of dentro) {
    if (f.inicio > cursor) vaos.push({ inicio: cursor, fim: f.inicio });
    cursor = Math.max(cursor, f.fim);
  }
  if (cursor < doTurno.fim) vaos.push({ inicio: cursor, fim: doTurno.fim });
  if (vaos.length === 0) return semHora;

  const alvo = Math.min(Math.max(minuto, doTurno.inicio), doTurno.fim);
  const distancia = (v: Janela) => (alvo < v.inicio ? v.inicio - alvo : alvo > v.fim ? alvo - v.fim : 0);
  const vao = vaos.reduce((melhor, v) => (distancia(v) < distancia(melhor) ? v : melhor));
  return { turno, horaInicio: formatMinuto(vao.inicio), horaFim: formatMinuto(vao.fim) };
}

/**
 * As horas que o painel da tarefa no celular oferece: do primeiro turno menos uma
 * hora ao último mais uma, de quinze em quinze. A irrigação das sete começa antes
 * da manhã das sete e meia.
 */
export function opcoesDeHora(turnos: readonly Pick<Turno, 'inicio' | 'fim' | 'ativo'>[]): string[] {
  const limites = turnos
    .filter((turno) => turno.ativo)
    .flatMap((turno) => [parseHora(turno.inicio), parseHora(turno.fim)])
    .filter((minuto): minuto is number => minuto !== null);
  const inicio = Math.max(0, Math.floor(((limites.length ? Math.min(...limites) : 7 * 60) - 60) / PASSO_MINUTOS) * PASSO_MINUTOS);
  const fim = Math.min(1440 - PASSO_MINUTOS, Math.ceil(((limites.length ? Math.max(...limites) : 17 * 60) + 60) / PASSO_MINUTOS) * PASSO_MINUTOS);
  const opcoes: string[] = [];
  for (let minuto = inicio; minuto <= fim; minuto += PASSO_MINUTOS) opcoes.push(formatMinuto(minuto));
  return opcoes;
}
