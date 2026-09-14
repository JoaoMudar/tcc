interface PageHeaderProps {
  /** Linha pequena acima do título: a área, como "2 · Produção". */
  area: string;
  title: string;
}

/** Cabeçalho verde das telas do F1 (mk-hd). */
export function PageHeader({ area, title }: PageHeaderProps) {
  return (
    <header className="bg-brand-dark px-4 py-3 text-white md:px-8 md:py-5">
      <p className="text-xs font-bold tracking-widest text-brand-muted uppercase">{area}</p>
      <h1 className="mt-0.5 text-xl leading-tight font-bold md:text-2xl">{title}</h1>
    </header>
  );
}
