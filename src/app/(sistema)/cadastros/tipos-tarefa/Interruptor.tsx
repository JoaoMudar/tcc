import type { InputHTMLAttributes } from 'react';

interface InterruptorProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  name: string;
  label: string;
}

/** Linha inteira tocável com a declaração do tipo de tarefa (mk-sw do F1 UC-15). */
export function Interruptor({ label, ...rest }: InterruptorProps) {
  return (
    <label className="flex min-h-touch items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 text-base text-ink has-disabled:opacity-60">
      {label}
      <input type="checkbox" className="size-6 accent-brand" {...rest} />
    </label>
  );
}
