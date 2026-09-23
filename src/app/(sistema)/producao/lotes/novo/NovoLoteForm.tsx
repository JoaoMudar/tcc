'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { type CanteiroResumo, lerQuantidade } from '@/lib/lotes-rotulos';
import { CanteiroPicker } from '../CanteiroPicker';
import { criarLoteAction } from '../actions';

interface NovoLoteFormProps {
  especies: readonly SelectOption[];
  recipientes: readonly SelectOption[];
  canteiros: readonly CanteiroResumo[];
  hoje: string;
}

/** F1 UC-22: espécie, recipiente, quantidade, área e canteiro; a data assume hoje. */
export function NovoLoteForm({ especies, recipientes, canteiros, hoje }: NovoLoteFormProps) {
  const [state, formAction, pending] = useActionState(criarLoteAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [quantidade, setQuantidade] = useState<number | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <SelectField label="Espécie" name="especie_id" options={especies} defaultValue={fields?.especie_id} required />
      <SelectField label="Recipiente" name="recipiente_id" options={recipientes} defaultValue={fields?.recipiente_id} required />
      <TextField
        label="Quantidade de mudas"
        name="quantidade"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={fields?.quantidade}
        onChange={(event) => setQuantidade(lerQuantidade(event.target.value))}
        required
      />
      <CanteiroPicker
        canteiros={canteiros}
        quantidade={quantidade}
        defaultAreaId={fields?.area_id}
        defaultCanteiroId={fields?.canteiro_id}
      />
      <TextField label="Data de criação" name="data_criacao" type="date" max={hoje} defaultValue={fields?.data_criacao ?? hoje} />
      <TextField label="Observação (opcional)" name="observacoes" maxLength={500} defaultValue={fields?.observacoes} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        Criar lote
      </Button>
    </form>
  );
}
