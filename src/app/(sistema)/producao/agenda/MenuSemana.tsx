import Link from 'next/link';
import { CopiarSemanaForm } from './CopiarSemanaForm';

interface MenuSemanaProps {
  semana: string;
  dia: string;
  podeMontar: boolean;
}

/** As ações em massa da semana ficam no ⋯, sem pesar mais que a própria agenda. */
export function MenuSemana({ semana, dia, podeMontar }: MenuSemanaProps) {
  if (!podeMontar) return null;
  return (
    <details className="relative">
      <summary
        aria-label="Mais ações da semana"
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-xl leading-none text-muted hover:bg-surface [&::-webkit-details-marker]:hidden"
      >
        ⋯
      </summary>
      <div className="absolute right-0 z-30 mt-1 flex w-60 flex-col rounded-lg border border-line bg-white py-1 shadow-lg">
        <Link href={`/producao/agenda/nova?semana=${semana}&dia=${dia}`} className="flex min-h-11 items-center px-3 text-sm text-ink hover:bg-surface">
          Lançar tarefa
        </Link>
        <CopiarSemanaForm semana={semana} />
      </div>
    </details>
  );
}
