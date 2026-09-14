import { type ReactNode, useId } from 'react';

interface SearchFormProps {
  label: string;
  name?: string;
  defaultValue?: string;
  /** Campos escondidos que a busca preserva, como o filtro de papel. */
  children?: ReactNode;
}

/**
 * Busca por GET: campo e botão numa peça só, com a mesma altura de toque (RNF-03).
 * O botão não disputa largura com o campo, que ocupa o resto da linha.
 */
export function SearchForm({ label, name = 'busca', defaultValue, children }: SearchFormProps) {
  const id = useId();

  return (
    <form role="search" className="flex flex-col gap-1">
      {children}
      <label htmlFor={id} className="text-sm font-semibold text-gray-700">
        {label}
      </label>
      <div className="flex overflow-hidden rounded-lg border-[1.5px] border-gray-300 bg-white focus-within:border-brand-dark">
        <input
          id={id}
          type="search"
          name={name}
          defaultValue={defaultValue}
          maxLength={80}
          className="min-h-touch min-w-0 flex-1 bg-transparent px-3 text-base text-ink focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-touch shrink-0 bg-brand px-5 text-base font-bold text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-white active:bg-brand-dark"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
