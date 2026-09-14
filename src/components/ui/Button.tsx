import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Gravação em andamento: trava o botão e troca o texto. */
  pending?: boolean;
  pendingLabel?: string;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white font-bold active:bg-brand-dark',
  secondary: 'bg-gray-100 text-gray-800 font-semibold active:bg-gray-200',
  outline: 'border-2 border-brand bg-white text-brand font-bold active:bg-brand-light',
};

/** Botão largo, com alvo de toque de 48px no mínimo (RNF-03). */
export function Button({
  variant = 'primary',
  pending = false,
  pendingLabel = 'Salvando…',
  type = 'button',
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex min-h-touch w-full items-center justify-center rounded-xl px-5 text-base transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
