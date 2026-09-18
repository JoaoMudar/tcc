'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE, type FormState } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { registrarContagemAction } from '../actions';

const PERCENTUAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** F1 UC-26, T4.6: o contado substitui o calculado, e a diferença aparece antes de confirmar (RN-09). */
export function ContagemForm({ loteId, saldo }: { loteId: string; saldo: number }) {
  const [state, formAction, pending] = useActionState(registrarContagemAction, EMPTY_FORM_STATE);
  // A chave recria os campos depois de gravar, e com eles a diferença calculada
  return <Campos key={state.success ?? 'contagem'} loteId={loteId} saldo={saldo} state={state} formAction={formAction} pending={pending} />;
}

interface CamposProps {
  loteId: string;
  saldo: number;
  state: FormState;
  formAction: (formData: FormData) => void;
  pending: boolean;
}

function Campos({ loteId, saldo, state, formAction, pending }: CamposProps) {
  const fields = state.error ? state.fields : undefined;
  const [contado, setContado] = useState<number | null>(lerQuantidade(fields?.contado ?? ''));
  const diferenca = contado === null ? 0 : contado - saldo;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lote_id" value={loteId} />
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">Calculado pelo sistema</span>
        <span className="text-lg font-bold text-ink">{formatQuantidade(saldo)}</span>
      </div>
      <TextField
        label="Contado agora"
        name="contado"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={fields?.contado}
        onChange={(event) => setContado(lerQuantidade(event.target.value))}
        required
      />
      {diferenca !== 0 && (
        <Notice tone="warning">
          Diferença de {formatQuantidade(Math.abs(diferenca))} mudas, {PERCENTUAL.format((Math.abs(diferenca) / saldo) * 100)}%{' '}
          {diferenca > 0 ? 'a mais' : 'a menos'}. A contagem passa a valer e a diferença fica registrada.
        </Notice>
      )}
      <TextField label="Observação (opcional)" name="observacoes" maxLength={500} defaultValue={fields?.observacoes} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      <Button type="submit" pending={pending}>
        Confirmar contagem
      </Button>
    </form>
  );
}
