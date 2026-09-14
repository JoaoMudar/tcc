import { PageHeader } from './PageHeader';

interface AreaPlaceholderProps {
  area: string;
  title: string;
}

/** Entrada provisória de uma área, até a fase que constrói as telas dela. */
export function AreaPlaceholder({ area, title }: AreaPlaceholderProps) {
  return (
    <main>
      <PageHeader area={area} title={title} />
      <p className="mx-auto max-w-3xl p-4 text-base text-muted md:p-8">
        As telas desta área ainda não foram construídas.
      </p>
    </main>
  );
}
