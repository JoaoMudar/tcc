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

export interface Faixa extends Janela {
  /** O fim mostrado foi inferido, e não declarado: a barra sai tracejada. */
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

/** Do começo do primeiro turno ao fim do último: é o que o eixo do dia mostra. */
export function janelaDoDia(turnos: readonly Turno[]): Janela {
  const janelas = turnos.filter((turno) => turno.ativo).map(minutosDoTurno).filter((janela): janela is Janela => janela !== null);
  if (janelas.length === 0) return JANELA_PADRAO;
  return {
    inicio: Math.min(...janelas.map((janela) => janela.inicio)),
    fim: Math.max(...janelas.map((janela) => janela.fim)),
  };
}

function janelaDoTurno(turnoId: string, turnos: readonly Turno[]): Janela {
  const turno = turnos.find((candidato) => candidato.id === turnoId);
  return (turno && minutosDoTurno(turno)) ?? janelaDoDia(turnos);
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

/** Onde o minuto cai no eixo do dia, de 0 a 100. */
export function percentualDoMinuto(minuto: number, janela: Janela): number {
  const total = Math.max(1, janela.fim - janela.inicio);
  return ((minuto - janela.inicio) / total) * 100;
}

/** Em porcentagem, porque a coluna do dia muda de largura com a janela do navegador. */
export function posicaoPercentual(faixa: Faixa, janela: Janela): { left: number; width: number } {
  const recortada = limitaNaJanela(faixa, janela);
  const left = percentualDoMinuto(recortada.inicio, janela);
  return { left, width: percentualDoMinuto(recortada.fim, janela) - left };
}

/**
 * As horas cheias dentro da janela, que a grade desenha como linha e o
 * cabeçalho numera: sem elas o eixo tem só as listras de turno, e a barra não
 * diz a olho se começa às oito ou às nove.
 */
export function marcasDeHora(janela: Janela): number[] {
  const primeira = Math.ceil(janela.inicio / 60) * 60;
  const marcas: number[] = [];
  for (let minuto = primeira; minuto <= janela.fim; minuto += 60) marcas.push(minuto);
  return marcas;
}

/** A fração horizontal da coluna vira minuto do dia. */
export function minutoNaPosicao(fracao: number, janela: Janela): number {
  const total = janela.fim - janela.inicio;
  return Math.min(Math.max(janela.inicio + fracao * total, janela.inicio), janela.fim);
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

/** Arrastar o corpo: a duração não muda, e a barra não sai do eixo do dia. */
export function moverFaixa(faixa: Faixa, deltaMinutos: number, janela: Janela): Faixa {
  const duracao = faixa.fim - faixa.inicio;
  const inicio = Math.min(Math.max(arredondaPasso(faixa.inicio + deltaMinutos), janela.inicio), janela.fim - duracao);
  return { inicio, fim: inicio + duracao, derivada: false };
}

/** Arrastar a borda: o outro lado fica parado, e a duração mínima é respeitada. */
export function redimensionarFaixa(faixa: Faixa, borda: Borda, deltaMinutos: number, janela: Janela): Faixa {
  if (borda === 'inicio') {
    const inicio = Math.min(Math.max(arredondaPasso(faixa.inicio + deltaMinutos), janela.inicio), faixa.fim - DURACAO_MINIMA);
    return { inicio, fim: faixa.fim, derivada: false };
  }
  const fim = Math.max(Math.min(arredondaPasso(faixa.fim + deltaMinutos), janela.fim), faixa.inicio + DURACAO_MINIMA);
  return { inicio: faixa.inicio, fim, derivada: false };
}

/** 450 → "07:30", que é o formato que a ação e o `time` do Postgres esperam. */
export function formatMinuto(minuto: number): string {
  const total = ((Math.round(minuto) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface BarraEmpilhada<T> {
  item: T;
  faixa: Faixa;
  /** Base zero: a sub-linha da pessoa em que a barra desenha. */
  linha: number;
}

/**
 * RF-26 admite mais de uma tarefa ao mesmo tempo. Com eixo de hora, o critério
 * de empilhar deixa de ser a contagem na célula e passa a ser a sobreposição:
 * quem não se cruza divide a mesma sub-linha.
 */
export function empilhar<T>(itens: readonly T[], faixaDe: (item: T) => Faixa): BarraEmpilhada<T>[] {
  const fimDaLinha: number[] = [];
  return [...itens]
    .map((item) => ({ item, faixa: faixaDe(item) }))
    .sort((um, outro) => um.faixa.inicio - outro.faixa.inicio || um.faixa.fim - outro.faixa.fim)
    .map(({ item, faixa }) => {
      const livre = fimDaLinha.findIndex((fim) => fim <= faixa.inicio);
      const linha = livre === -1 ? fimDaLinha.length : livre;
      fimDaLinha[linha] = faixa.fim;
      return { item, faixa, linha };
    });
}

export function contarLinhas(barras: readonly BarraEmpilhada<unknown>[]): number {
  return Math.max(1, ...barras.map((barra) => barra.linha + 1));
}
