import type { SelectOption } from '@/components/ui/SelectField';

interface EscolhaMultiplaProps {
  legenda: string;
  name: string;
  opcoes: readonly SelectOption[];
  marcados: ReadonlySet<string>;
  /** `radio` quando só vale uma. */
  tipo?: 'checkbox' | 'radio';
  colunas?: 2 | 3;
}

/** Pessoas, dias e turno são tocados, nunca digitados (RNF-02), com alvo de toque grande (RNF-03). */
export function EscolhaMultipla({ legenda, name, opcoes, marcados, tipo = 'checkbox', colunas = 2 }: EscolhaMultiplaProps) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-semibold text-gray-700">{legenda}</legend>
      <div className={`grid gap-2 ${colunas === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {opcoes.map((opcao) => (
          <label
            key={opcao.value}
            className="flex min-h-touch items-center gap-2 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink has-[:checked]:border-brand-dark has-[:checked]:bg-brand-light has-[:checked]:font-semibold"
          >
            <input
              type={tipo}
              name={name}
              value={opcao.value}
              defaultChecked={marcados.has(opcao.value)}
              className="size-5 shrink-0 accent-brand-dark"
            />
            {opcao.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
