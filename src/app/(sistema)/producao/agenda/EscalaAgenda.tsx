import Link from 'next/link';
import { inicioDaSemana } from '@/lib/semanas';

/** O botão de escala do F1: a agenda da semana não é outra tela, é a mesma agenda em outra escala. */
export function EscalaAgenda({ escala, dia }: { escala: 'dia' | 'semana'; dia: string }) {
  const opcoes = [
    { id: 'dia', label: 'Dia', href: `/producao?dia=${dia}` },
    { id: 'semana', label: 'Semana', href: `/producao/agenda?semana=${inicioDaSemana(dia)}` },
  ] as const;
  return (
    <div role="group" aria-label="Escala da agenda" className="inline-flex rounded-xl border border-line bg-white p-1">
      {opcoes.map((opcao) => (
        <Link
          key={opcao.id}
          href={opcao.href}
          aria-current={opcao.id === escala ? 'true' : undefined}
          className={`inline-flex min-h-10 min-w-20 items-center justify-center rounded-lg px-3 text-base font-semibold ${
            opcao.id === escala ? 'bg-brand-dark text-white' : 'text-muted'
          }`}
        >
          {opcao.label}
        </Link>
      ))}
    </div>
  );
}
