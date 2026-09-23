'use client';

import Link from 'next/link';
import {
  type PointerEvent as ReactPointerEvent,
  startTransition,
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from 'react';
import { Notice } from '@/components/ui/Notice';
import type { AtribuicaoResumo, LinhaGrade } from '@/lib/agenda';
import {
  type EstadoTarefa,
  ESTADOS_TAREFA,
  GLIFO_ESTADO,
  estadoTarefa,
  formatHoraTarefa,
} from '@/lib/agenda-rotulos';
import {
  type Faixa,
  type Janela,
  empilhar,
  contarLinhas,
  faixaDaBarra,
  formatMinuto,
  janelaDoDia,
  marcasDeHora,
  percentualDoMinuto,
  posicaoPercentual,
  turnoDoMinuto,
  turnoParaMinuto,
} from '@/lib/agenda-grade';
import { diaMes, nomeDia, siglaDia } from '@/lib/semanas';
import { type Turno, turnoLabel } from '@/lib/turnos';
import { type OpcoesAtribuicao } from './AtribuicaoForm';
import { NovaTarefaModal, type PontoDaAgenda } from './NovaTarefaModal';
import { type AlvoArrasto, type Reagendamento, useArrasteBarra } from './useArrasteBarra';
import { reagendarAtribuicaoAction } from './actions';

interface GanttSemanaProps {
  grade: LinhaGrade[];
  dias: string[];
  /** Só os turnos em uso: a geometria nasce da contagem, e não de "manhã e tarde". */
  turnos: Turno[];
  hoje: string;
  className?: string;
  /** Início da semana, que o formulário do modal exige. */
  semana: string;
  /** Arrastar remarca, e exige alterar a agenda. */
  podeArrastar?: boolean;
  /** As listas do formulário: só chegam quando se pode lançar. */
  opcoes?: OpcoesAtribuicao;
}

/** A cor diz a conclusão; o glifo e o rótulo dizem a mesma coisa sem depender dela. */
const BARRA: Record<EstadoTarefa, string> = {
  feita: 'bg-feito text-white',
  parcial: 'bg-atencao text-ink',
  presumida: 'bg-atencao text-ink',
  nao_feita: 'bg-nao-feito text-white',
  planejada: 'bg-line text-ink',
  cancelada: 'bg-line text-muted line-through',
};

/** Os estados que a legenda explica: cancelada e planejada se leem sozinhas. */
const NA_LEGENDA: EstadoTarefa[] = ['feita', 'parcial', 'presumida', 'nao_feita'];

/** Altura de cada sub-linha da pessoa, em pixels: a barra precisa caber no toque. */
const ALTURA_LINHA = 40;

/**
 * T5.1, F1 UC-19: a semana como linha do tempo, uma faixa por pessoa. Em tela
 * larga o dia é eixo de hora real (RNF-14): a barra pode ser arrastada para
 * remarcar e ter a borda puxada para mudar a duração, e o vazio clicado lança
 * tarefa ali mesmo. No celular a página mostra a lista.
 */
export function GanttSemana({
  grade,
  dias,
  turnos,
  hoje,
  className = '',
  semana,
  podeArrastar = false,
  opcoes,
}: GanttSemanaProps) {
  const janela = janelaDoDia(turnos);
  const [erro, setErro] = useState<string | null>(null);
  const [ponto, setPonto] = useState<PontoDaAgenda | null>(null);
  /** O que o arrasto está produzindo, para quem não vê a etiqueta (RNF-03). */
  const [anuncio, setAnuncio] = useState('');

  const lancarEm = useCallback(
    (dia: string, minuto: number) => {
      if (!opcoes) return;
      const turno = turnoParaMinuto(minuto, turnos);
      if (!turno) return;
      setPonto({ dia, turnoId: turno.id, horaInicio: formatMinuto(minuto), horaFim: formatMinuto(Math.min(minuto + 60, janela.fim)) });
    },
    [opcoes, turnos, janela.fim],
  );

  return (
    <div className={className}>
      {erro && <Notice tone="error">{erro}</Notice>}

      <div className="flex flex-col gap-1">
        {/* Cabeçalho: o dia abrange o seu eixo, e cada turno diz o seu nome e o seu início. */}
        <div className="flex items-end gap-2">
          <span className="w-36 shrink-0 text-xs font-bold tracking-widest text-muted uppercase">Pessoa</span>
          <div className="grid flex-1 gap-0" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}>
            {dias.map((dia) => (
              <div
                key={dia}
                className={`border-r border-line last:border-r-0 ${dia === hoje ? 'bg-brand-light/25' : ''}`}
              >
                <Link
                  href={`/producao?dia=${dia}`}
                  className={`block text-xs font-bold tracking-widest uppercase underline-offset-2 hover:underline ${
                    dia === hoje ? 'text-brand-dark' : 'text-muted'
                  }`}
                >
                  {siglaDia(dia)} {diaMes(dia)}
                </Link>
                <div className="relative mt-0.5 h-4">
                  <FundoTurnos turnos={turnos} janela={janela} rotulado />
                </div>
                <ReguaDeHoras janela={janela} />
              </div>
            ))}
          </div>
        </div>

        {grade.map((linha) => (
          <FaixaPessoa
            key={linha.pessoa?.id ?? 'sem-ninguem'}
            linha={linha}
            dias={dias}
            hoje={hoje}
            turnos={turnos}
            janela={janela}
            podeArrastar={podeArrastar}
            podeLancar={Boolean(opcoes)}
            onLancar={lancarEm}
            onErro={setErro}
            onHorario={setAnuncio}
          />
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
        {NA_LEGENDA.map((estado) => (
          <li key={estado} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] text-[10px] font-bold ${BARRA[estado]}`}
            >
              {GLIFO_ESTADO[estado]}
            </span>
            {ESTADOS_TAREFA[estado]}
          </li>
        ))}
        <li className="text-muted">Presumida: a semana fechou sem alguém confirmar.</li>
        {podeArrastar && (
          <li className="text-muted">Arraste a barra para remarcar, ou a borda para mudar a duração, de quinze em quinze minutos.</li>
        )}
      </ul>

      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>

      {ponto && opcoes && (
        <NovaTarefaModal semana={semana} opcoes={opcoes} ponto={ponto} onFechar={() => setPonto(null)} />
      )}
    </div>
  );
}

/** As listras do turno, atrás das barras: é o que mantém o turno legível no eixo de hora. */
function FundoTurnos({ turnos, janela, rotulado = false }: { turnos: readonly Turno[]; janela: Janela; rotulado?: boolean }) {
  return (
    <>
      {turnos.map((turno) => {
        const { left, width } = posicaoPercentual(faixaDaBarra({ turnoId: turno.id, horaInicio: null, horaFim: null }, turnos), janela);
        return (
          <div
            key={turno.id}
            aria-hidden
            style={{ left: `${left}%`, width: `${width}%` }}
            className={`absolute inset-y-0 overflow-hidden ${rotulado ? 'text-[10px] text-muted' : 'rounded bg-brand-light/30'}`}
          >
            {rotulado && (
              <span className="truncate">
                {turnoLabel(turno.nome)} · {turno.inicio}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * Os números das horas no cabeçalho do dia. A primeira e a última ficam
 * ancoradas na borda da coluna, e as do meio centradas na própria linha.
 */
function ReguaDeHoras({ janela }: { janela: Janela }) {
  const marcas = marcasDeHora(janela);
  return (
    <div className="relative mt-0.5 h-3 text-[10px] leading-3 text-muted">
      {marcas.map((minuto, indice) => {
        const primeira = indice === 0;
        const ultima = indice === marcas.length - 1;
        return (
          <span
            key={minuto}
            aria-hidden
            style={{ left: `${percentualDoMinuto(minuto, janela)}%` }}
            className={`absolute tabular-nums ${primeira ? '' : ultima ? '-translate-x-full' : '-translate-x-1/2'}`}
          >
            {Math.floor(minuto / 60)}
          </span>
        );
      })}
    </div>
  );
}

/** As linhas de hora em hora, atrás das barras: dentro do turno mais firmes, fora mais fracas. */
function MarcasDeHora({ janela, turnos }: { janela: Janela; turnos: readonly Turno[] }) {
  return (
    <>
      {marcasDeHora(janela).map((minuto) => {
        const esquerda = percentualDoMinuto(minuto, janela);
        // A marca da ponta cairia em cima da régua do dia, e somaria 2px sujos na borda.
        if (esquerda === 0 || esquerda === 100) return null;
        return (
          <div
            key={minuto}
            aria-hidden
            style={{ left: `${esquerda}%` }}
            className={`absolute inset-y-0 w-px ${turnoDoMinuto(minuto, turnos) ? 'bg-line' : 'bg-line/40'}`}
          />
        );
      })}
    </>
  );
}

interface FaixaPessoaProps {
  linha: LinhaGrade;
  dias: string[];
  hoje: string;
  turnos: Turno[];
  janela: Janela;
  podeArrastar: boolean;
  podeLancar: boolean;
  onLancar: (dia: string, minuto: number) => void;
  onErro: (mensagem: string | null) => void;
  onHorario: (texto: string) => void;
}

function FaixaPessoa({
  linha,
  dias,
  hoje,
  turnos,
  janela,
  podeArrastar,
  podeLancar,
  onLancar,
  onErro,
  onHorario,
}: FaixaPessoaProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [porDia, aplicarOtimista] = useOptimistic(
    linha.porDia,
    (atual: Record<string, AtribuicaoResumo[]>, mudanca: Reagendamento & { turnoId: string }) => {
      const remendo = (a: AtribuicaoResumo): AtribuicaoResumo =>
        a.id === mudanca.id
          ? {
              ...a,
              data: mudanca.dia,
              turnoId: mudanca.turnoId,
              horaInicio: formatMinuto(mudanca.faixa.inicio),
              horaFim: formatMinuto(mudanca.faixa.fim),
            }
          : a;
      const semAtarefa = (lista: AtribuicaoResumo[]) => lista.filter((a) => a.id !== mudanca.id);
      const movida = (atual[mudanca.diaOriginal] ?? []).find((a) => a.id === mudanca.id);
      if (!movida || mudanca.dia === mudanca.diaOriginal) {
        return Object.fromEntries(Object.entries(atual).map(([dia, lista]) => [dia, lista.map(remendo)]));
      }
      return {
        ...Object.fromEntries(Object.entries(atual).map(([dia, lista]) => [dia, semAtarefa(lista)])),
        [mudanca.dia]: [...semAtarefa(atual[mudanca.dia] ?? []), remendo(movida)],
      };
    },
  );

  const reagendar = useCallback(
    (resultado: Reagendamento) => {
      const turno = turnoParaMinuto(resultado.faixa.inicio, turnos);
      if (!turno) return;
      onHorario(intervalo(resultado.faixa));
      startTransition(async () => {
        aplicarOtimista({ ...resultado, turnoId: turno.id });
        const dados = new FormData();
        dados.set('id', resultado.id);
        dados.set('data', resultado.dia);
        dados.set('turno_id', turno.id);
        dados.set('hora_inicio', formatMinuto(resultado.faixa.inicio));
        dados.set('hora_fim', formatMinuto(resultado.faixa.fim));
        const estado = await reagendarAtribuicaoAction({}, dados);
        onErro(estado.error ?? null);
      });
    },
    [turnos, aplicarOtimista, onErro, onHorario],
  );

  const { sessao, iniciar, aoTeclar } = useArrasteBarra({ dias, janela, areaRef, onSoltar: reagendar });

  // Fora do render: avisar de dentro do arrasto derrubaria o estado otimista
  useEffect(() => {
    if (sessao) onHorario(intervalo(sessao.faixa));
  }, [sessao, onHorario]);

  /** A barra em arrasto desenha onde o ponteiro está, e não onde o banco a guarda. */
  const barrasDoDia = (dia: string) => {
    const doDia = (porDia[dia] ?? []).filter((a) => !(sessao && sessao.id === a.id && sessao.dia !== dia));
    const emTransito = sessao && sessao.dia === dia && !doDia.some((a) => a.id === sessao.id);
    const lista = emTransito ? [...doDia, ...acharTarefa(porDia, sessao.id)] : doDia;
    return empilhar(lista, (a) => (sessao?.id === a.id ? sessao.faixa : faixaDaBarra(a, turnos)));
  };

  const linhas = Math.max(1, ...dias.map((dia) => contarLinhas(barrasDoDia(dia))));

  return (
    <div className="flex items-stretch gap-2 border-t border-line py-1">
      <span className="w-36 shrink-0 self-center truncate text-base font-semibold text-ink">
        {linha.pessoa?.nome ?? <span className="text-muted">Sem ninguém</span>}
      </span>
      <div
        ref={areaRef}
        className="grid flex-1 gap-0"
        style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))`, height: linhas * ALTURA_LINHA }}
      >
        {dias.map((dia) => (
          <ColunaDia
            key={dia}
            dia={dia}
            eHoje={dia === hoje}
            barras={barrasDoDia(dia)}
            linhas={linhas}
            turnos={turnos}
            janela={janela}
            podeArrastar={podeArrastar}
            podeLancar={podeLancar}
            onLancar={onLancar}
            emArrasto={sessao?.id ?? null}
            iniciar={iniciar}
            aoTeclar={aoTeclar}
          />
        ))}
      </div>
    </div>
  );
}

/** "07:30–08:30": o que a etiqueta mostra e o leitor de tela anuncia. */
function intervalo(faixa: Faixa): string {
  return `${formatMinuto(faixa.inicio)}–${formatMinuto(faixa.fim)}`;
}

function acharTarefa(porDia: Record<string, AtribuicaoResumo[]>, id: string): AtribuicaoResumo[] {
  for (const lista of Object.values(porDia)) {
    const achada = lista.find((a) => a.id === id);
    if (achada) return [achada];
  }
  return [];
}

interface ColunaDiaProps {
  dia: string;
  /** Hoje tinge a coluna inteira: a régua precisa de um dia para onde apontar. */
  eHoje: boolean;
  barras: ReturnType<typeof empilhar<AtribuicaoResumo>>;
  linhas: number;
  turnos: Turno[];
  janela: Janela;
  podeArrastar: boolean;
  podeLancar: boolean;
  onLancar: (dia: string, minuto: number) => void;
  /** A tarefa em arrasto, que desenha a etiqueta do horário. */
  emArrasto: string | null;
  iniciar: (evento: ReactPointerEvent<HTMLElement>, alvo: AlvoArrasto, modo: 'mover' | 'inicio' | 'fim') => void;
  aoTeclar: (evento: React.KeyboardEvent<HTMLElement>, alvo: AlvoArrasto) => void;
}

function ColunaDia({
  dia,
  eHoje,
  barras,
  linhas,
  turnos,
  janela,
  podeArrastar,
  podeLancar,
  onLancar,
  emArrasto,
  iniciar,
  aoTeclar,
}: ColunaDiaProps) {
  /** O clique no vazio vira hora pela posição dentro da coluna do dia. */
  const aoClicarNoVazio = (evento: React.MouseEvent<HTMLElement>) => {
    if (!podeLancar) return;
    const rect = evento.currentTarget.getBoundingClientRect();
    const fracao = Math.min(Math.max((evento.clientX - rect.left) / Math.max(1, rect.width), 0), 1);
    onLancar(dia, janela.inicio + fracao * (janela.fim - janela.inicio));
  };

  return (
    <div
      className={`relative border-r border-line last:border-r-0 ${eHoje ? 'bg-brand-light/25' : ''}`}
      aria-label={nomeDia(dia)}
    >
      <FundoTurnos turnos={turnos} janela={janela} />
      <MarcasDeHora turnos={turnos} janela={janela} />
      {podeLancar && (
        <button
          type="button"
          onClick={aoClicarNoVazio}
          aria-label={`Lançar tarefa em ${nomeDia(dia)}`}
          className="absolute inset-0 h-full w-full cursor-copy rounded focus-visible:outline-2 focus-visible:outline-brand-dark"
        />
      )}
      {barras.map(({ item, faixa, linha }) => (
        <Barra
          key={item.id}
          atribuicao={item}
          dia={dia}
          faixa={faixa}
          janela={janela}
          topo={(linha * 100) / linhas}
          altura={100 / linhas}
          arrastavel={podeArrastar && item.situacao === 'planejada'}
          emArrasto={emArrasto === item.id}
          iniciar={iniciar}
          aoTeclar={aoTeclar}
        />
      ))}
    </div>
  );
}

interface BarraProps {
  atribuicao: AtribuicaoResumo;
  dia: string;
  faixa: Faixa;
  janela: Janela;
  topo: number;
  altura: number;
  arrastavel: boolean;
  emArrasto: boolean;
  iniciar: ColunaDiaProps['iniciar'];
  aoTeclar: ColunaDiaProps['aoTeclar'];
}

function Barra({ atribuicao: a, dia, faixa, janela, topo, altura, arrastavel, emArrasto, iniciar, aoTeclar }: BarraProps) {
  const estado = estadoTarefa(a);
  const hora = formatHoraTarefa(a.horaInicio, a.horaFim);
  const { left, width } = posicaoPercentual(faixa, janela);
  const alvo: AlvoArrasto = { id: a.id, dia, faixa };
  const arrastouDe = useRef<number | null>(null);

  return (
    <div
      style={{ left: `${left}%`, width: `${width}%`, top: `${topo}%`, height: `${altura}%` }}
      className="absolute flex items-stretch p-[1px]"
    >
      {emArrasto && (
        <span
          aria-hidden
          className={`pointer-events-none absolute left-0 z-10 rounded bg-ink px-1 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow ${
            topo === 0 ? 'top-full mt-0.5' : 'bottom-full mb-0.5'
          }`}
        >
          {intervalo(faixa)}
        </span>
      )}
      <Link
        href={`/producao/agenda/${a.id}`}
        aria-label={`${a.tipo}, ${nomeDia(dia)}, ${turnoLabel(a.turno)}, ${ESTADOS_TAREFA[estado]}`}
        title={`${a.tipo} · ${ESTADOS_TAREFA[estado]}${faixa.derivada ? ' · sem hora marcada' : ''}`}
        onPointerDown={(evento) => {
          if (!arrastavel) return;
          arrastouDe.current = evento.clientX;
          iniciar(evento, alvo, 'mover');
        }}
        onClick={(evento) => {
          // O arrasto termina num clique: sem isto, mover a barra abriria a ficha
          if (arrastouDe.current !== null && Math.abs(evento.clientX - arrastouDe.current) > 4) evento.preventDefault();
          arrastouDe.current = null;
        }}
        onKeyDown={(evento) => arrastavel && aoTeclar(evento, alvo)}
        className={`relative flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 text-xs font-semibold hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-dark forced-colors:outline forced-colors:outline-1 ${
          BARRA[estado]
        } ${faixa.derivada ? 'border border-dashed border-current/50' : ''} ${arrastavel ? 'cursor-grab touch-none' : ''}`}
      >
        <span aria-hidden className="shrink-0">
          {GLIFO_ESTADO[estado]}
        </span>
        <span className="truncate">
          {a.tipo}
          {hora && <span className="font-normal"> · {hora}</span>}
        </span>

        {arrastavel && (
          <>
            <Alca posicao="inicio" rotulo={`Mudar o início de ${a.tipo}`} onIniciar={(evento) => iniciar(evento, alvo, 'inicio')} />
            <Alca posicao="fim" rotulo={`Mudar o fim de ${a.tipo}`} onIniciar={(evento) => iniciar(evento, alvo, 'fim')} />
          </>
        )}
      </Link>
    </div>
  );
}

/** A borda que se puxa. Fica dentro da barra para não roubar a coluna vizinha. */
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
      className={`absolute inset-y-0 w-1.5 cursor-ew-resize touch-none ${posicao === 'inicio' ? 'left-0' : 'right-0'}`}
    />
  );
}
