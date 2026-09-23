'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { saveProtocolo } from './actions';

interface ProtocoloFormProps {
  protocolo: { id: string; nome: string; recipiente: string; observacoes: string | null; ativo: boolean };
  podeEditar: boolean;
}

export function ProtocoloForm({ protocolo, podeEditar }: ProtocoloFormProps) {
  const [state, formAction, pending] = useActionState(saveProtocolo, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <input type="hidden" name="protocolo_id" value={protocolo.id} />
      <p className="text-sm text-muted">
        Rege os lotes criados em <strong className="font-semibold text-ink">{protocolo.recipiente}</strong>. O
        recipiente não muda: o protocolo pertence a ele.
      </p>
      <fieldset disabled={!podeEditar} className="flex flex-col gap-3">
        <TextField label="Nome" name="nome" defaultValue={protocolo.nome} required />
        <TextField
          label="Observação (opcional)"
          name="observacoes"
          maxLength={500}
          defaultValue={protocolo.observacoes ?? ''}
        />
        {podeEditar && (
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativo" defaultChecked={protocolo.ativo} className="size-6 accent-brand" />
            Vigente
          </label>
        )}
      </fieldset>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      {podeEditar && (
        <Button type="submit" variant="secondary" pending={pending}>
          Salvar
        </Button>
      )}
    </form>
  );
}
