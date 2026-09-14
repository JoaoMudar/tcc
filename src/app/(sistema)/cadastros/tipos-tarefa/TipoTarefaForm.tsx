'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { Interruptor } from './Interruptor';
import { saveTipoTarefa } from './actions';

interface TipoTarefaFormProps {
  tipo?: {
    id: string;
    nome: string;
    categoria: string;
    eQuantitativa: boolean;
    exigeLote: boolean;
    exigeEspecie: boolean;
    exigeRecipiente: boolean;
    ativo: boolean;
  };
  categorias: readonly SelectOption[];
  podeEditar: boolean;
}

export function TipoTarefaForm({ tipo, categorias, podeEditar }: TipoTarefaFormProps) {
  const [state, formAction, pending] = useActionState(saveTipoTarefa, EMPTY_FORM_STATE);
  const [exigeLote, setExigeLote] = useState(tipo?.exigeLote ?? false);
  const fields = state.error ? state.fields : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset disabled={!podeEditar} className="flex flex-col gap-3">
        {tipo && <input type="hidden" name="tipo_id" value={tipo.id} />}
        <TextField label="Nome" name="nome" defaultValue={fields?.nome ?? tipo?.nome} required />
        <SelectField
          label="Categoria"
          name="categoria"
          options={categorias}
          defaultValue={fields?.categoria ?? tipo?.categoria}
          required
        />

        <h2 className="mt-3 text-sm font-bold tracking-widest text-muted uppercase">O que esta tarefa exige</h2>
        <Interruptor name="e_quantitativa" label="Quantitativa por unidade" defaultChecked={tipo?.eQuantitativa} />
        <Interruptor
          name="exige_lote"
          label="Exige lote específico"
          checked={exigeLote}
          onChange={(event) => setExigeLote(event.currentTarget.checked)}
        />
        <Interruptor
          key={String(exigeLote)}
          name="exige_especie"
          label="Exige espécie"
          disabled={exigeLote}
          defaultChecked={!exigeLote && tipo?.exigeEspecie}
        />
        <Interruptor name="exige_recipiente" label="Exige recipiente" defaultChecked={tipo?.exigeRecipiente} />
        {exigeLote && (
          <Notice tone="info">O lote já determina a espécie. Por isso a espécie não é pedida na agenda nem na confirmação.</Notice>
        )}

        {tipo && podeEditar && (
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativo" defaultChecked={tipo.ativo} className="size-6 accent-brand" />
            Em uso na agenda
          </label>
        )}
      </fieldset>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      {podeEditar && (
        <Button type="submit" pending={pending}>
          Salvar
        </Button>
      )}
    </form>
  );
}
