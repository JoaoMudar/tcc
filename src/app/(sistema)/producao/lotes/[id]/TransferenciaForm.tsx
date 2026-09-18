'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import type { CanteiroResumo } from '@/lib/lotes-rotulos';
import { CanteiroPicker } from '../CanteiroPicker';
import { transferirLoteAction } from '../actions';

interface TransferenciaFormProps {
  loteId: string;
  saldo: number;
  canteiroAtualId: string;
  canteiros: readonly CanteiroResumo[];
}

/** T4.7: a mesma leva muda de lugar sem trocar de recipiente, e o código continua o mesmo. */
export function TransferenciaForm({ loteId, saldo, canteiroAtualId, canteiros }: TransferenciaFormProps) {
  const [state, formAction, pending] = useActionState(transferirLoteAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;

  return (
    <form key={state.success ?? 'transferencia'} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lote_id" value={loteId} />
      <CanteiroPicker
        canteiros={canteiros}
        quantidade={saldo}
        excluirCanteiroId={canteiroAtualId}
        defaultAreaId={fields?.area_id}
        defaultCanteiroId={fields?.canteiro_id}
        sufixo=" de destino"
      />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" variant="outline" pending={pending}>
        Transferir
      </Button>
    </form>
  );
}
