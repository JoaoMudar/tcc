import { Fragment, useId, type SelectHTMLAttributes } from 'react';
import { classeRotulo } from './marcaObrigatorio';

export interface SelectOption {
  value: string;
  label: string;
  /** Linha miúda embaixo do rótulo, no `ComboboxField`: o nome científico da espécie. */
  detalhe?: string;
  /** Título do `optgroup`: as opções seguidas com o mesmo grupo saem juntas debaixo dele. */
  grupo?: string;
}

export type BlocoOpcoes = { grupo: string | undefined; opcoes: SelectOption[] };

/** Junta as opções seguidas do mesmo grupo; a opção sem grupo forma bloco solto. */
export function agruparOpcoes(options: readonly SelectOption[]): BlocoOpcoes[] {
  const blocos: BlocoOpcoes[] = [];
  for (const option of options) {
    const ultimo = blocos.at(-1);
    if (ultimo && ultimo.grupo === option.grupo) ultimo.opcoes.push(option);
    else blocos.push({ grupo: option.grupo, opcoes: [option] });
  }
  return blocos;
}

function renderOpcoes(opcoes: readonly SelectOption[]) {
  return opcoes.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ));
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> {
  label: string;
  name: string;
  options: readonly SelectOption[];
  placeholder?: string;
  error?: string;
}

/** Categoria é sempre lista fechada, nunca texto digitado (RNF-02). */
export function SelectField({
  label,
  options,
  placeholder = 'Escolha…',
  error,
  className = '',
  defaultValue,
  value,
  ...rest
}: SelectFieldProps) {
  const id = useId();
  const errorId = error ? `${id}-erro` : undefined;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className={classeRotulo(rest.required)}>
        {label}
      </label>
      <select
        id={id}
        // Controlado (value) e não-controlado (defaultValue) não convivem no mesmo select
        {...(value === undefined ? { defaultValue: defaultValue ?? '' } : { value })}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className="min-h-touch w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink focus:border-brand-dark focus:outline-none aria-invalid:border-red-600"
        {...rest}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {agruparOpcoes(options).map((bloco) => {
          const key = `${bloco.grupo ?? ''}:${bloco.opcoes[0].value}`;
          return bloco.grupo === undefined ? (
            <Fragment key={key}>{renderOpcoes(bloco.opcoes)}</Fragment>
          ) : (
            <optgroup key={key} label={bloco.grupo}>
              {renderOpcoes(bloco.opcoes)}
            </optgroup>
          );
        })}
      </select>
      {error && (
        <p id={errorId} className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
