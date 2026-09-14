'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { updateParametros } from '../actions';

interface ParametroCampo {
  chave: string;
  valor: string;
  tipoValor: 'texto' | 'numero' | 'booleano' | 'data';
  label: string;
  unidade: string;
  dica: string;
  alteracao: string;
}

interface ParametrosFormProps {
  parametros: readonly ParametroCampo[];
  podeEditar: boolean;
}

export function ParametrosForm({ parametros, podeEditar }: ParametrosFormProps) {
  const [state, formAction, pending] = useActionState(updateParametros, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {parametros.map((parametro) => {
        const name = `valor:${parametro.chave}`;
        const hint = [parametro.dica, parametro.alteracao].filter(Boolean).join('. ') || undefined;
        return (
          <div key={parametro.chave} className="rounded-xl border border-line bg-white p-4">
            <TextField
              label={parametro.unidade ? `${parametro.label} (${parametro.unidade})` : parametro.label}
              name={name}
              type={parametro.tipoValor === 'data' ? 'date' : 'text'}
              inputMode={parametro.tipoValor === 'numero' ? 'numeric' : undefined}
              defaultValue={state.fields?.[name] ?? parametro.valor}
              hint={hint}
              disabled={!podeEditar}
              required
            />
          </div>
        );
      })}
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
