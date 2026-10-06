'use client';

import Link from 'next/link';
import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import type { AtribuicaoResumo } from '@/lib/agenda';
import {
  type Degrau,
  type Eixo,
  type Faixa,
  duracaoUtil,
  faixaDoTexto,
  faixaVertical,
  formatMinuto,
  posicaoPercentual,
  recortePerfil,
} from '@/lib/agenda-grade';
import { ESTADOS_TAREFA, type EstadoTarefa, estadoNaGrade, formatHoraTarefa } from '@/lib/agenda-rotulos';
import { COR_CATEGORIA, FUNDO_CATEGORIA } from '@/lib/cores-categoria';
import { nomeDia } from '@/lib/semanas';
import { turnoLabel } from '@/lib/turnos';
import { IconeEstado } from './IconeEstado';
import { ListaSobrepostas } from './ListaSobrepostas';
import type { AlvoArrasto, ModoArrasto } from './useArrasteBarra';

/** A partir desta largura o card mostra título em duas linhas e o horário. */
export const LARGURA_COMPLETA = 110;
/** Abaixo desta, o card é só a faixa de cor, e o título vai para fora ou para o tooltip. */
export const LARGURA_MINIMA_TEXTO = 48;

interface BarraTarefaProps {
  atribuicao: AtribuicaoResumo;
  /** A faixa inteira da tarefa vai no alvo: é ela que o arrasto move. */
  alvo: AlvoArrasto;
  /** O que o card ocupa no eixo: a tarefa inteira, mesmo cruzada por outra. */
  desenho: Faixa;
  /** A altura em cada pedaço: cruzada por outra, só ali ela perde a faixa da outra (RF-26). */
  perfil: readonly Degrau<AtribuicaoResumo>[];
  janela: Eixo;
  /** Minutos de eixo livres à direita do card: onde o título do card estreito pode ficar. */
  livreDepois: number;
  /** Os lados que tocam outro card na mesma altura: ali não há recuo, porque não há vão de tempo. */
  encosta?: { inicio: boolean; fim: boolean };
  arrastavel: boolean;
  /** Pode virar a principal: a semana está aberta e quem vê pode alterar. */
  promovivel: boolean;
  /** A semana já pode ser fechada: o card diz, pela cor cheia, o que falta confirmar. */
  aFechar?: boolean;
  /** É o fantasma do arrasto, desenhado onde o ponteiro está. */
  emArrasto: boolean;
  /** No arrasto para a linha de outra pessoa, quem passa a fazer: vai no balão. */
  destino?: string | null;
  onPromover: (id: string) => void;
  iniciar: (evento: ReactPointerEvent<HTMLElement>, alvo: AlvoArrasto, modo: ModoArrasto) => void;
  aoTeclar: (evento: KeyboardEvent<HTMLElement>, alvo: AlvoArrasto) => void;
}

/** "07:30–08:30": o que a etiqueta mostra e o leitor de tela anuncia. */
export function intervalo(faixa: Faixa): string {
  return `${formatMinuto(faixa.inicio)}–${formatMinuto(faixa.fim)}`;
}

type Nivel = 'barra' | 'linha' | 'completo';

/**
 * A largura que o card tem de fato na tela. Muda com a janela e com o dia que se
 * expande sob o mouse, e é ela, e nada mais, que decide quanto texto cabe. Sem
 * `ResizeObserver` (o jsdom dos testes), vale o card completo.
 */
function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState<number | null>(null);
  useEffect(() => {
    const elemento = ref.current;
    if (!elemento || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);
  return { ref, largura };
}

function nivelDa(largura: number | null): Nivel {
  if (largura === null || largura >= LARGURA_COMPLETA) return 'completo';
  return largura >= LARGURA_MINIMA_TEXTO ? 'linha' : 'barra';
}

/** O recuo do card dentro da caixa da barra, em pixels (o `p-0.5`). */
const RECUO = 2;

/**
 * A cor cheia do card. Na semana que já pode ser fechada, ela diz o que o
 * fechamento vai fazer: âmbar para o que ninguém confirmou (entra presumido),
 * verde para o confirmado. Nas outras, o confirmado ganha a cor da categoria.
 * Nula quando o card fica só tingido.
 */
export function corCheia(estado: EstadoTarefa, categoria: keyof typeof COR_CATEGORIA, aFechar: boolean): string | null {
  const confirmada = estado === 'feita' || estado === 'parcial' || estado === 'nao_feita';
  if (aFechar && estado === 'presumida') return 'bg-atencao';
  if (aFechar && confirmada) return 'bg-feito';
  return confirmada ? COR_CATEGORIA[categoria] : null;
}

/** Quebra só entre palavras: nunca "Adub/ar". */
const SEM_QUEBRA_NA_PALAVRA = '[word-break:normal] [overflow-wrap:normal] hyphens-none';

/**
 * Uma tarefa no Gantt da semana, com o desenho de cartão: a faixa de cor diz a
 * categoria, o fundo tingido a repete de leve, o ícone diz a conclusão só quando
 * foge do planejado, e o que foi feito pesa menos. O conteúdo segue a largura:
 * título e horário a partir de 110px, título numa linha a partir de 48px, e só a
 * faixa abaixo disso. Toca para abrir a ficha; o corpo se arrasta e as bordas se
 * puxam. Cruzada com outra da mesma pessoa, a tarefa continua um card só, do
 * início ao fim: só o pedaço cruzado perde altura, a principal fica com a faixa
 * de cima, a secundária com a de baixo, e ela pode virar a principal (RF-26).
 */
export function BarraTarefa({
  atribuicao: a,
  alvo,
  desenho,
  perfil,
  janela,
  livreDepois,
  encosta = { inicio: false, fim: false },
  arrastavel,
  promovivel,
  aFechar = false,
  emArrasto,
  destino,
  onPromover,
  iniciar,
  aoTeclar,
}: BarraTarefaProps) {
  const estado = estadoNaGrade(a, aFechar);
  const hora = formatHoraTarefa(a.horaInicio, a.horaFim)?.replace(' às ', '–');
  // O que já foi feito (ou, na semana a fechar, o que falta confirmar) ganha cor cheia: precisa saltar aos olhos
  const cheia = emArrasto ? null : corCheia(estado, a.categoria, aFechar);
  const confirmada = cheia !== null;
  const apagada = estado === 'cancelada';
  const secundaria = perfil.some((d) => d.camada > 0);
  const { left, width } = posicaoPercentual(desenho, janela);
  const recuo = { inicio: encosta.inicio ? 0 : RECUO, fim: encosta.fim ? 0 : RECUO, topo: RECUO, base: RECUO };
  const recorte = recortePerfil(desenho, perfil, janela, recuo);
  // O texto fica no começo do card, na altura que nenhum cruzamento corta
  const texto = faixaDoTexto(perfil);
  const compacto = texto.altura < 100;
  const embaixo = texto.topo > 0;
  /** O pedaço do degrau dentro do card, em porcentagem da largura dele. */
  const noCard = (d: Degrau<AtribuicaoResumo>) => {
    const p = posicaoPercentual({ inicio: d.inicio, fim: d.fim, derivada: false }, janela);
    return width > 0 ? { left: ((p.left - left) / width) * 100, width: (p.width / width) * 100 } : { left: 0, width: 100 };
  };
  // O "Tornar principal" vai no primeiro pedaço em que ela está embaixo; o "+N", em cada pedaço que o tem
  const primeiraEmbaixo = perfil.findIndex((d) => d.camada > 0);
  const extras = perfil
    .map((d, indice) => ({ d, indice, promover: indice === primeiraEmbaixo && promovivel, ocultas: d.ocultas }))
    .filter((e) => e.promover || e.ocultas.length > 0);
  const { ref, largura } = useLargura<HTMLAnchorElement>();
  const nivel = nivelDa(largura);
  // O título do card estreito vai para o vão à direita, se o vão comporta texto
  const pxPorMinuto = largura === null ? 0 : largura / Math.max(1, duracaoUtil(desenho, janela));
  const larguraFora = nivel === 'barra' ? Math.floor(livreDepois * pxPorMinuto) - 4 : 0;

  // O arrasto termina num clique: sem isto, mover a barra abriria a ficha
  const arrastouDe = useRef<{ x: number; y: number } | null>(null);
  const arrastou = (evento: { clientX: number; clientY: number }) =>
    arrastouDe.current !== null &&
    Math.max(Math.abs(evento.clientX - arrastouDe.current.x), Math.abs(evento.clientY - arrastouDe.current.y)) > 4;

  const titulo = `${a.tipo} · ${hora ?? `${turnoLabel(a.turno).toLowerCase()}, sem hora marcada`}`;

  return (
    <div
      style={{ left: `${left}%`, width: `${width}%` }}
      className={`group/barra pointer-events-none absolute inset-y-0 flex items-stretch py-0.5 ${encosta.inicio ? '' : 'pl-0.5'} ${
        encosta.fim ? '' : 'pr-0.5'
      } ${emArrasto ? 'z-20' : 'z-10 transition-[left,width] duration-150 ease-out'}`}
    >
      {emArrasto && <EtiquetaHora faixa={alvo.faixa} destino={destino ?? null} />}
      <Link
        ref={ref}
        href={`/producao/agenda/${a.id}`}
        aria-label={`${a.tipo}, ${nomeDia(alvo.dia)}, ${hora ?? turnoLabel(a.turno)}, ${ESTADOS_TAREFA[estado]}${secundaria ? ', na faixa de baixo' : ''}`}
        title={titulo}
        style={recorte ? { clipPath: recorte } : undefined}
        data-recorte={recorte}
        onPointerDown={(evento) => {
          if (!arrastavel) return;
          arrastouDe.current = { x: evento.clientX, y: evento.clientY };
          iniciar(evento, alvo, 'mover');
        }}
        onClick={(evento) => {
          if (arrastou(evento)) evento.preventDefault();
          arrastouDe.current = null;
        }}
        onKeyDown={(evento) => {
          if (secundaria && promovivel && evento.shiftKey && evento.key === 'ArrowUp') {
            evento.preventDefault();
            onPromover(a.id);
          } else if (arrastavel) aoTeclar(evento, alvo);
        }}
        className={`pointer-events-auto relative flex min-w-0 flex-1 gap-1 overflow-hidden rounded-md ${encosta.inicio ? 'rounded-l-none' : ''} ${
          encosta.fim ? 'rounded-r-none border-r-0' : ''
        } border pr-1 pl-2 text-left hover:border-gray-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-dark ${
          cheia ? `${cheia} border-transparent` : `${FUNDO_CATEGORIA[a.categoria]} border-line`
        } ${compacto ? '' : 'items-start py-1'} ${arrastavel ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${
          emArrasto ? 'bg-white shadow-lg ring-2 ring-brand' : ''
        }`}
      >
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${COR_CATEGORIA[a.categoria]}`} />
        {nivel !== 'barra' && (
          <span
            style={compacto ? { top: `${texto.topo}%`, height: `${texto.altura}%` } : undefined}
            className={`flex min-w-0 flex-1 gap-1 ${compacto ? `absolute inset-x-0 pr-1 pl-2 ${embaixo ? 'items-center' : 'items-start pt-0.5'}` : ''}`}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span
                className={`${SEM_QUEBRA_NA_PALAVRA} leading-tight font-medium ${embaixo ? 'text-[11px]' : 'text-xs'} ${
                  nivel === 'completo' && !compacto ? 'line-clamp-2' : 'truncate'
                } ${confirmada ? 'text-white' : apagada ? 'text-muted' : 'text-ink'} ${estado === 'cancelada' ? 'line-through' : ''}`}
              >
                {a.tipo}
              </span>
              {nivel === 'completo' && !embaixo && (
                <span className={`truncate text-[11px] leading-tight tabular-nums ${confirmada ? 'text-white/85' : 'text-muted'}`}>
                  {hora ?? turnoLabel(a.turno)}
                </span>
              )}
            </span>
            {/* Sobre a cor cheia, o verde, o âmbar e o vermelho do ícone só leem num fundo branco */}
            <IconeEstado estado={estado} className={`text-xs ${confirmada ? 'h-4 self-start rounded-full bg-white px-1 items-center' : ''}`} />
          </span>
        )}

        {arrastavel && (
          <Alca posicao="inicio" rotulo={`Mudar o início de ${a.tipo}`} onIniciar={(evento) => iniciar(evento, alvo, 'inicio')} />
        )}
        {arrastavel && <Alca posicao="fim" rotulo={`Mudar o fim de ${a.tipo}`} onIniciar={(evento) => iniciar(evento, alvo, 'fim')} />}
      </Link>

      {larguraFora >= LARGURA_MINIMA_TEXTO && (
        <span
          aria-hidden
          style={{ width: larguraFora }}
          className={`pointer-events-none absolute top-1/2 left-full -translate-y-1/2 truncate pl-1 text-[11px] text-muted ${SEM_QUEBRA_NA_PALAVRA}`}
        >
          {a.tipo}
        </span>
      )}

      {!emArrasto &&
        extras.map(({ d, indice, promover, ocultas }) => {
          const { topo, altura } = faixaVertical(d.camada, d.camadas);
          const { left: esquerda, width: largo } = noCard(d);
          return (
            <span
              key={indice}
              style={{ left: `${esquerda}%`, width: `${largo}%`, top: `${topo}%`, height: `${altura}%` }}
              className="absolute z-10 flex items-center justify-end gap-0.5 pr-2"
            >
              {promover && (
                <button
                  type="button"
                  onClick={() => onPromover(a.id)}
                  aria-label={`Tornar principal: ${a.tipo}`}
                  title="Tornar principal"
                  className="pointer-events-auto rounded bg-white/80 px-1 text-xs leading-4 text-muted opacity-0 group-hover/barra:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-dark"
                >
                  ⤒
                </button>
              )}
              {ocultas.length > 0 && (
                <span className="pointer-events-auto">
                  <ListaSobrepostas tarefas={ocultas} promovivel={promovivel} onPromover={onPromover} />
                </span>
              )}
            </span>
          );
        })}
    </div>
  );
}

/** O horário que a barra em arrasto vai ganhar, num balão acima dela, e a pessoa nova quando muda de linha. */
function EtiquetaHora({ faixa, destino }: { faixa: Faixa; destino: string | null }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 rounded bg-ink px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white tabular-nums shadow"
    >
      {intervalo(faixa)}
      {destino && <span className="ml-1 font-normal">→ {destino}</span>}
    </span>
  );
}

/** A borda que se puxa, 6px. Fica dentro da barra para não roubar a coluna vizinha; o traço aparece no hover. */
function Alca({
  posicao,
  rotulo,
  onIniciar,
}: {
  posicao: 'inicio' | 'fim';
  rotulo: string;
  onIniciar: (evento: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <span
      role="separator"
      aria-label={rotulo}
      onPointerDown={(evento) => {
        evento.stopPropagation();
        onIniciar(evento);
      }}
      onClick={(evento) => evento.preventDefault()}
      className={`absolute inset-y-0 flex w-1.5 cursor-ew-resize touch-none items-center justify-center ${posicao === 'inicio' ? 'left-0' : 'right-0'}`}
    >
      <span aria-hidden className="h-1/2 w-0.5 rounded bg-gray-500 opacity-0 group-hover/barra:opacity-100" />
    </span>
  );
}
