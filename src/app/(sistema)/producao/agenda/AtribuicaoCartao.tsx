import Link from 'next/link';
import { Pill } from '@/components/ui/Pill';
import {
  type AtribuicaoResumo,
  ESTADOS_TAREFA,
  TOM_ESTADO,
  detalhesAtribuicao,
  estadoTarefa,
  formatHoraTarefa,
  formatQuantidadeMedida,
} from '@/lib/agenda';
import { turnoLabel } from '@/lib/turnos';

interface AtribuicaoCartaoProps {
  atribuicao: AtribuicaoResumo;
  /** Na agenda do dia o turno já é o título do grupo. */
  mostrarTurno?: boolean;
}

/** Uma tarefa da agenda: o tipo, a hora se tiver, o grupo e o que ela leva. Toca para abrir. */
export function AtribuicaoCartao({ atribuicao: a, mostrarTurno = false }: AtribuicaoCartaoProps) {
  const hora = formatHoraTarefa(a.horaInicio, a.horaFim);
  const quando = [mostrarTurno && turnoLabel(a.turno), hora].filter(Boolean).join(' · ');
  const detalhes = detalhesAtribuicao(a);
  const estado = estadoTarefa(a);

  return (
    <Link
      href={`/producao/agenda/${a.id}`}
      className="flex flex-col gap-1 rounded-xl border border-line bg-white p-3 active:bg-brand-light"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-ink">
          {a.tipo}
          {a.eRecorrente && <span className="font-normal text-muted"> · recorrente</span>}
        </span>
        <Pill tone={TOM_ESTADO[estado]}>{ESTADOS_TAREFA[estado]}</Pill>
      </div>
      {quando && <span className="text-sm font-semibold text-brand-dark">{quando}</span>}
      {detalhes.length > 0 && <span className="text-sm text-muted">{detalhes.join(' · ')}</span>}
      <span className="text-sm text-ink">
        {a.participantes.length === 0
          ? 'Ninguém escalado'
          : a.participantes
              .map((p) => (p.quantidade === null ? p.nome : `${p.nome} (${formatQuantidadeMedida(p.quantidade, a.unidadeMedida)})`))
              .join(', ')}
      </span>
    </Link>
  );
}
