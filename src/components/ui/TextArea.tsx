'use client';

import { type InputEvent, type TextareaHTMLAttributes, useEffect, useId, useRef } from 'react';
import { classeRotulo } from './marcaObrigatorio';

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  name: string;
  hint?: string;
  /**
   * A caixa cresce com o texto, a cada quebra de linha, em vez de rolar por
   * dentro. `rows` vira a altura mínima.
   */
  ajustaAltura?: boolean;
}

/** Leva a altura da caixa até a do texto. `auto` antes, para ela também encolher. */
function ajustar(campo: HTMLTextAreaElement) {
  campo.style.height = 'auto';
  campo.style.height = `${campo.scrollHeight}px`;
}

/** Texto de mais de uma linha: nomes populares, um por linha, e observações. */
export function TextArea({ label, hint, className = '', rows = 3, ajustaAltura = false, onInput, ...rest }: TextAreaProps) {
  const id = useId();
  const hintId = hint ? `${id}-dica` : undefined;
  const campoRef = useRef<HTMLTextAreaElement>(null);

  // O texto que já veio preenchido (o formulário devolvido com erro) também ajusta
  useEffect(() => {
    if (ajustaAltura && campoRef.current) ajustar(campoRef.current);
  }, [ajustaAltura, rest.value]);

  function aoDigitar(evento: InputEvent<HTMLTextAreaElement>) {
    if (ajustaAltura) ajustar(evento.currentTarget);
    onInput?.(evento);
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className={classeRotulo(rest.required)}>
        {label}
      </label>
      <textarea
        ref={campoRef}
        id={id}
        rows={rows}
        aria-describedby={hintId}
        onInput={aoDigitar}
        className={`w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-3 py-2 text-base text-ink placeholder:text-gray-400 focus:border-brand-dark focus:outline-none disabled:bg-gray-50 ${
          ajustaAltura ? 'min-h-touch resize-none overflow-hidden' : ''
        }`}
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
