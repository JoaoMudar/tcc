import type { ReactNode } from 'react';

/** Uma ação da ficha, fechada até ser tocada: a ficha fica curta no celular. */
export function AcaoRecolhivel({ titulo, aberta = false, children }: { titulo: string; aberta?: boolean; children: ReactNode }) {
  return (
    <details open={aberta} className="group rounded-xl border border-line bg-white">
      <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between px-4 text-base font-semibold text-ink">
        {titulo}
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
