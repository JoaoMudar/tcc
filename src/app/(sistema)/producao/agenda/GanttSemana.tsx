import Link from 'next/link';
import {
  type AtribuicaoResumo,
  type EstadoTarefa,
  type LinhaGrade,
  ESTADOS_TAREFA,
  GLIFO_ESTADO,
  estadoTarefa,
  formatHoraTarefa,
} from '@/lib/agenda';
import { diaMes, nomeDia, siglaDia } from '@/lib/semanas';
import { type Turno, turnoLabel } from '@/lib/turnos';

interface GanttSemanaProps {
  grade: LinhaGrade[];
  dias: string[];
  /** Só os turnos em uso: a geometria nasce da contagem, e não de "manhã e tarde". */
  turnos: Turno[];
  hoje: string;
  className?: string;
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

/**
 * T5.1, F1 UC-19: a semana como linha do tempo, uma faixa por pessoa e uma
 * barra por turno. Tela larga só (RNF-14); no celular a página mostra a lista.
 */
export function GanttSemana({ grade, dias, turnos, hoje, className = '' }: GanttSemanaProps) {
  const colunas = dias.length * turnos.length;
  const gridColunas = { gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` };

  return (
    <div className={className}>
      <div className="flex flex-col gap-1">
        {/* Cabeçalho: o dia abrange os seus turnos, e cada turno diz a sua inicial. */}
        <div className="flex items-end gap-2">
          <span className="w-36 shrink-0 text-xs font-bold tracking-widest text-muted uppercase">Pessoa</span>
          <div className="grid flex-1 gap-[2px]" style={gridColunas}>
            {dias.map((dia) => (
              <div key={dia} style={{ gridColumn: `span ${turnos.length}` }}>
                <Link
                  href={`/producao?dia=${dia}`}
                  className={`block text-xs font-bold tracking-widest uppercase underline-offset-2 hover:underline ${
                    dia === hoje ? 'text-brand-dark' : 'text-muted'
                  }`}
                >
                  {siglaDia(dia)} {diaMes(dia)}
                </Link>
                <div className="mt-0.5 grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${turnos.length}, minmax(0, 1fr))` }}>
                  {turnos.map((turno) => (
                    <span key={turno.id} className="truncate text-[10px] text-muted" title={turnoLabel(turno.nome)}>
                      {turnoLabel(turno.nome)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {grade.map((linha) => (
          <FaixaPessoa
            key={linha.pessoa?.id ?? 'sem-ninguem'}
            linha={linha}
            dias={dias}
            turnos={turnos}
            gridColunas={gridColunas}
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
      </ul>
    </div>
  );
}

interface FaixaPessoaProps {
  linha: LinhaGrade;
  dias: string[];
  turnos: Turno[];
  gridColunas: { gridTemplateColumns: string };
}

function FaixaPessoa({ linha, dias, turnos, gridColunas }: FaixaPessoaProps) {
  /** RF-26 admite mais de uma tarefa no mesmo turno: cada uma ganha a sua sub-linha. */
  const celula = (dia: string, turnoId: string): AtribuicaoResumo[] =>
    (linha.porDia[dia] ?? []).filter((a) => a.turnoId === turnoId);

  const faixas = Math.max(1, ...dias.flatMap((dia) => turnos.map((turno) => celula(dia, turno.id).length)));

  return (
    <div className="flex items-stretch gap-2 border-t border-line py-1">
      <span className="w-36 shrink-0 self-center truncate text-base font-semibold text-ink">
        {linha.pessoa?.nome ?? <span className="text-muted">Sem ninguém</span>}
      </span>
      <div
        className="grid flex-1 gap-[2px]"
        style={{ ...gridColunas, gridTemplateRows: `repeat(${faixas}, minmax(0, 1fr))` }}
      >
        {dias.map((dia, indiceDia) =>
          turnos.map((turno, indiceTurno) =>
            celula(dia, turno.id).map((a, faixa) => (
              <Barra
                key={a.id}
                atribuicao={a}
                dia={dia}
                turno={turno}
                coluna={indiceDia * turnos.length + indiceTurno + 1}
                faixa={faixa + 1}
              />
            )),
          ),
        )}
      </div>
    </div>
  );
}

function Barra({
  atribuicao: a,
  dia,
  turno,
  coluna,
  faixa,
}: {
  atribuicao: AtribuicaoResumo;
  dia: string;
  turno: Turno;
  coluna: number;
  faixa: number;
}) {
  const estado = estadoTarefa(a);
  const hora = formatHoraTarefa(a.horaInicio, a.horaFim);

  return (
    <Link
      href={`/producao/agenda/${a.id}`}
      style={{ gridColumn: coluna, gridRow: faixa }}
      aria-label={`${a.tipo}, ${nomeDia(dia)}, ${turnoLabel(turno.nome)}, ${ESTADOS_TAREFA[estado]}`}
      title={`${a.tipo} · ${ESTADOS_TAREFA[estado]}`}
      className={`flex min-h-7 items-center gap-1 rounded px-1.5 text-xs font-semibold hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-dark forced-colors:outline forced-colors:outline-1 ${BARRA[estado]}`}
    >
      <span aria-hidden className="shrink-0">
        {GLIFO_ESTADO[estado]}
      </span>
      <span className="truncate">
        {a.tipo}
        {hora && <span className="font-normal"> · {hora}</span>}
      </span>
    </Link>
  );
}
