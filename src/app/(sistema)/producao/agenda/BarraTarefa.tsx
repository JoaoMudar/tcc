'use client';

import Link from 'next/link';
import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import type { AtribuicaoResumo } from '@/lib/agenda';
import { type Eixo, type Faixa, duracaoUtil, formatMinuto, posicaoPercentual } from '@/lib/agenda-grade';
import { ESTADOS_TAREFA, estadoTarefa, formatHoraTarefa } from '@/lib/agenda-rotulos';
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
  /** O pedaço desenhado: cruzada por outra, a tarefa sai em mais de um (RF-26). */
  desenho: Faixa;
  /** 0 é a principal; de 1 em diante, as secundárias da faixa de baixo. */
  camada: number;
  /** As bordas do pedaço que são bordas reais da tarefa: só nelas a alça aparece. */
  alcas: { inicio: boolean; fim: boolean };
  /** Na última faixa: as tarefas que também se cruzam ali e não couberam na altura. */
  ocultas: readonly AtribuicaoResumo[];
  janela: Eixo;
  /** Minutos de eixo livres à direita do pedaço: onde o título do card estreito pode ficar. */
  livreDepois: number;
  /** Os lados que tocam outro card na mesma altura: ali não há recuo, porque não há vão de tempo. */
  encosta?: { inicio: boolean; fim: boolean };
  /** Em porcentagem da altura da linha. */
  topo: number;
  altura: number;
  arrastavel: boolean;
  /** Pode virar a principal: a semana está aberta e quem vê pode alterar. */
  promovivel: boolean;
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

/** Quebra só entre palavras: nunca "Adub/ar". */
const SEM_QUEBRA_NA_PALAVRA = '[word-break:normal] [overflow-wrap:normal] hyphens-none';

/**
 * Uma tarefa no Gantt da semana, com o desenho de cartão: a faixa de cor diz a
 * categoria, o fundo tingido a repete de leve, o ícone diz a conclusão só quando
 * foge do planejado, e o que foi feito pesa menos. O conteúdo segue a largura:
 * título e horário a partir de 110px, título numa linha a partir de 48px, e só a
 * faixa abaixo disso. Toca para abrir a ficha; o corpo se arrasta e as bordas se
 * puxam. Cruzada com outra da mesma pessoa, a secundária ocupa a faixa de baixo
 * com o título numa linha e pode virar a principal (RF-26).
 */
export function BarraTarefa({
  atribuicao: a,
  alvo,
  desenho,
  camada,
  alcas,
  ocultas,
  janela,
  livreDepois,
  encosta = { inicio: false, fim: false },
  topo,
  altura,
  arrastavel,
  promovivel,
  emArrasto,
  destino,
  onPromover,
  iniciar,
  aoTeclar,
}: BarraTarefaProps) {
  const estado = estadoTarefa(a);
  const hora = formatHoraTarefa(a.horaInicio, a.horaFim)?.replace(' às ', '–');
  const apagada = estado === 'feita' || estado === 'cancelada';
  const secundaria = camada > 0;
  const { left, width } = posicaoPercentual(desenho, janela);
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
      style={{ left: `${left}%`, width: `${width}%`, top: `${topo}%`, height: `${altura}%` }}
      className={`group/barra absolute flex items-stretch ${secundaria ? 'pb-0.5' : 'py-0.5'} ${encosta.inicio ? '' : 'pl-0.5'} ${
        encosta.fim ? '' : 'pr-0.5'
      } ${
        emArrasto ? 'z-20' : 'z-10 transition-[left,width,top,height] duration-150 ease-out'
      }`}
    >
      {emArrasto && <EtiquetaHora faixa={alvo.faixa} destino={destino ?? null} />}
      <Link
        ref={ref}
        href={`/producao/agenda/${a.id}`}
        aria-label={`${a.tipo}, ${nomeDia(alvo.dia)}, ${hora ?? turnoLabel(a.turno)}, ${ESTADOS_TAREFA[estado]}${secundaria ? ', na faixa de baixo' : ''}`}
        title={titulo}
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
        className={`relative flex min-w-0 flex-1 gap-1 overflow-hidden rounded-md ${encosta.inicio ? 'rounded-l-none' : ''} ${
          encosta.fim ? 'rounded-r-none border-r-0' : ''
        } border border-line pr-1 pl-2 text-left hover:border-gray-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-dark ${
          FUNDO_CATEGORIA[a.categoria]
        } ${secundaria ? 'items-center' : 'items-start py-1'} ${arrastavel ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${
          emArrasto ? 'bg-white shadow-lg ring-2 ring-brand' : ''
        }`}
      >
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${COR_CATEGORIA[a.categoria]}`} />
        {nivel !== 'barra' && (
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className={`${SEM_QUEBRA_NA_PALAVRA} leading-tight font-medium ${secundaria ? 'text-[11px]' : 'text-xs'} ${
                nivel === 'completo' && !secundaria ? 'line-clamp-2' : 'truncate'
              } ${apagada ? 'text-muted' : 'text-ink'} ${estado === 'cancelada' ? 'line-through' : ''}`}
            >
              {a.tipo}
            </span>
            {nivel === 'completo' && !secundaria && (
              <span className="truncate text-[11px] leading-tight text-muted tabular-nums">{hora ?? turnoLabel(a.turno)}</span>
            )}
          </span>
        )}
        {nivel !== 'barra' && <IconeEstado estado={estado} className="text-xs" />}

        {arrastavel && alcas.inicio && (
          <Alca posicao="inicio" rotulo={`Mudar o início de ${a.tipo}`} onIniciar={(evento) => iniciar(evento, alvo, 'inicio')} />
        )}
        {arrastavel && alcas.fim && <Alca posicao="fim" rotulo={`Mudar o fim de ${a.tipo}`} onIniciar={(evento) => iniciar(evento, alvo, 'fim')} />}
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

      {!emArrasto && ((secundaria && promovivel) || ocultas.length > 0) && (
        <span className="absolute inset-y-0 right-2 z-10 flex items-center gap-0.5 pb-0.5">
          {secundaria && promovivel && (
            <button
              type="button"
              onClick={() => onPromover(a.id)}
              aria-label={`Tornar principal: ${a.tipo}`}
              title="Tornar principal"
              className="rounded bg-white/80 px-1 text-xs leading-4 text-muted opacity-0 group-hover/barra:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-brand-dark"
            >
              ⤒
            </button>
          )}
          {ocultas.length > 0 && <ListaSobrepostas tarefas={ocultas} promovivel={promovivel} onPromover={onPromover} />}
        </span>
      )}
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
