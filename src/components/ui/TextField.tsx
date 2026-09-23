import { useId, type InputHTMLAttributes } from 'react';
import { classeRotulo } from './marcaObrigatorio';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  name?: string;
  hint?: string;
  error?: string;
  /**
   * Célula de planilha: o rótulo vira só leitura de tela, porque quem o lê com
   * os olhos já o leu no cabeçalho da coluna, e o campo perde a moldura, porque
   * a borda é a da grade.
   */
  compacto?: boolean;
}

export function TextField({ label, hint, error, compacto = false, className = '', ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;

  return (
    <div className={`${compacto ? '' : 'flex flex-col gap-1'} ${className}`}>
      <label htmlFor={id} className={compacto ? 'sr-only' : classeRotulo(rest.required)}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={
          compacto
            ? 'h-11 w-full bg-transparent px-3 text-base text-ink placeholder:text-gray-400 focus:bg-white focus:outline-2 focus:-outline-offset-2 focus:outline-brand aria-invalid:text-red-700'
            : 'min-h-touch w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink placeholder:text-gray-400 focus:border-brand-dark focus:outline-none aria-invalid:border-red-600'
        }
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
