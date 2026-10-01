import { type EstadoTarefa, ESTADOS_TAREFA, GLIFO_ESTADO } from '@/lib/agenda-rotulos';

/** Planejada é o padrão e não ganha ícone: só o que foge dele aparece. */
const COR: Partial<Record<EstadoTarefa, string>> = {
  feita: 'text-feito',
  parcial: 'text-atencao',
  presumida: 'text-atencao',
  nao_feita: 'text-nao-feito',
  cancelada: 'text-muted',
};

/** O `title` faz o papel da legenda que a tela deixou de ter. */
export const EXPLICACAO: Partial<Record<EstadoTarefa, string>> = {
  feita: 'Feita',
  parcial: 'Parcial: fizeram menos que o previsto',
  presumida: 'Presumida: a semana fechou sem alguém confirmar',
  nao_feita: 'Não feita: a contagem deu zero',
  cancelada: 'Cancelada',
};

export function IconeEstado({ estado, className = '' }: { estado: EstadoTarefa; className?: string }) {
  if (estado === 'planejada') return null;
  return (
    <span
      role="img"
      aria-label={ESTADOS_TAREFA[estado]}
      title={EXPLICACAO[estado]}
      className={`inline-flex shrink-0 font-bold leading-none ${COR[estado]} ${className}`}
    >
      {GLIFO_ESTADO[estado]}
    </span>
  );
}
