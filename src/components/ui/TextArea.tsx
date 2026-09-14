import { useId, type TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  name: string;
  hint?: string;
}

/** Texto de mais de uma linha: nomes populares, um por linha, e observações. */
export function TextArea({ label, hint, className = '', rows = 3, ...rest }: TextAreaProps) {
  const id = useId();
  const hintId = hint ? `${id}-dica` : undefined;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-describedby={hintId}
        className="w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-3 py-2 text-base text-ink placeholder:text-gray-400 focus:border-brand-dark focus:outline-none disabled:bg-gray-50"
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
