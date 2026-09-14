import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { ENDERECO_LABELS, type Endereco, type TipoEndereco, UFS, enderecoFieldName } from '@/lib/pessoas-form';

interface EnderecoFieldsProps {
  tipo: TipoEndereco;
  endereco?: Endereco;
  /** Valores digitados, quando a action recusou. */
  fields?: Record<string, string>;
}

const UF_OPTIONS = UFS.map((uf) => ({ value: uf, label: uf }));

/** Endereço dobrado por padrão: aberto só quando já tem dado, para a ficha não virar um formulário longo. */
export function EnderecoFields({ tipo, endereco, fields }: EnderecoFieldsProps) {
  const valor = (campo: 'logradouro' | 'cidade' | 'uf' | 'cep') => fields?.[enderecoFieldName(tipo, campo)] ?? endereco?.[campo] ?? '';
  const temDado = Boolean(valor('logradouro') || valor('cidade') || valor('uf') || valor('cep'));

  return (
    <details open={temDado} className="rounded-xl border border-line bg-white px-4">
      <summary className="flex min-h-touch cursor-pointer items-center text-base font-semibold text-gray-700">
        {ENDERECO_LABELS[tipo]}
      </summary>
      <div className="flex flex-col gap-3 pb-4">
        <TextField label="Rua e número" name={enderecoFieldName(tipo, 'logradouro')} defaultValue={valor('logradouro')} />
        <div className="grid grid-cols-[3fr_1fr] gap-3">
          <TextField label="Cidade" name={enderecoFieldName(tipo, 'cidade')} defaultValue={valor('cidade')} />
          <SelectField label="UF" name={enderecoFieldName(tipo, 'uf')} options={UF_OPTIONS} placeholder="UF" defaultValue={valor('uf')} />
        </div>
        <TextField label="CEP" name={enderecoFieldName(tipo, 'cep')} inputMode="numeric" defaultValue={valor('cep')} />
      </div>
    </details>
  );
}
