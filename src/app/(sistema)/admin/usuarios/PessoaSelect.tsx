import { SelectField } from '@/components/ui/SelectField';
import { SEM_PESSOA } from '@/lib/perfis';

interface PessoaSelectProps {
  pessoas: readonly { id: string; nome: string }[];
  defaultValue?: string | null;
}

/** Vínculo opcional com a pessoa do cadastro único. */
export function PessoaSelect({ pessoas, defaultValue }: PessoaSelectProps) {
  return (
    <SelectField
      label="Pessoa do cadastro"
      name="pessoa_id"
      options={[{ value: SEM_PESSOA, label: 'Sem vínculo' }, ...pessoas.map((p) => ({ value: p.id, label: p.nome }))]}
      defaultValue={defaultValue ?? SEM_PESSOA}
    />
  );
}
