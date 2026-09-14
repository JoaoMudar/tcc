import Link from 'next/link';

const ABAS = [
  { id: 'agenda', href: '/producao', label: 'Agenda' },
  { id: 'mapa', href: '/producao?aba=mapa', label: 'Mapa de produção' },
] as const;

/** T5.7, F1 "Entrada da área Produção": as duas perguntas de quem abre a Produção, uma por aba. */
export function ProducaoAbas({ aba }: { aba: (typeof ABAS)[number]['id'] }) {
  return (
    <nav aria-label="Visões da produção" className="flex border-b border-line bg-white px-2 md:px-6">
      {ABAS.map((item) => {
        const ativa = item.id === aba;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={ativa ? 'page' : undefined}
            className={`inline-flex min-h-touch items-center border-b-[3px] px-3 text-base font-semibold ${
              ativa ? 'border-brand text-brand-dark' : 'border-transparent text-muted'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
