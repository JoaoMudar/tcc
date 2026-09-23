import { MARCA_OBRIGATORIO } from '@/components/ui/marcaObrigatorio';
import { CAUSAS_PERDA } from '@/lib/lotes-rotulos';

interface CausaPickerProps {
  legenda?: string;
  defaultValue?: string;
  required?: boolean;
}

/** RN-10: a causa é tocada numa lista fechada, nunca digitada (RNF-02). */
export function CausaPicker({ legenda = 'Causa', defaultValue, required = true }: CausaPickerProps) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className={`mb-1 text-sm font-semibold text-gray-700 ${required ? MARCA_OBRIGATORIO : ''}`}>{legenda}</legend>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(CAUSAS_PERDA).map(([valor, rotulo]) => (
          <label
            key={valor}
            className="flex min-h-touch items-center gap-2 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink has-[:checked]:border-brand-dark has-[:checked]:bg-brand-light has-[:checked]:font-semibold"
          >
            <input
              type="radio"
              name="causa"
              value={valor}
              defaultChecked={defaultValue === valor}
              required={required}
              className="size-5 accent-brand-dark"
            />
            {rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
