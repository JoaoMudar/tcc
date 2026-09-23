'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { type CanteiroResumo, formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { CanteiroPicker } from '../CanteiroPicker';
import { dividirLoteAction } from '../actions';

interface DivisaoFormProps {
  loteId: string;
  codigo: string;
  saldo: number;
  canteiros: readonly CanteiroResumo[];
  /** Canteiro atual do lote: é o destino natural dos dois resultantes. */
  canteiroAtualId: string | null;
}

/**
 * F1 UC-24, T6.10: quantas mudas vão para o segundo lote, e onde cada um fica.
 * Os dois podem ficar no mesmo canteiro (FA-1): a divisão é quase sempre
 * contábil, e não física.
 */
export function DivisaoForm({ loteId, codigo, saldo, canteiros, canteiroAtualId }: DivisaoFormProps) {
  const [state, formAction, pending] = useActionState(dividirLoteAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [separar, setSeparar] = useState<number | null>(lerQuantidade(fields?.quantidade ?? ''));
  const fica = separar === null ? null : saldo - separar;
  const atual = canteiros.find((c) => c.id === canteiroAtualId);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lote_id" value={loteId} />
      <TextField
        label="Quantas vão para o segundo lote"
        name="quantidade"
        inputMode="numeric"
        autoComplete="off"
        hint={`O lote tem ${formatQuantidade(saldo)} mudas. O primeiro fica com o resto.`}
        defaultValue={fields?.quantidade}
        onChange={(event) => setSeparar(lerQuantidade(event.target.value))}
        required
      />
      <CanteiroPicker
        canteiros={canteiros}
        quantidade={fica}
        defaultAreaId={fields?.area_a_id ?? atual?.areaId}
        defaultCanteiroId={fields?.canteiro_a_id ?? canteiroAtualId ?? undefined}
        sufixo=" do primeiro lote"
        nomeArea="area_a_id"
        nomeCanteiro="canteiro_a_id"
      />
      <CanteiroPicker
        canteiros={canteiros}
        quantidade={separar}
        defaultAreaId={fields?.area_b_id ?? atual?.areaId}
        defaultCanteiroId={fields?.canteiro_b_id ?? canteiroAtualId ?? undefined}
        sufixo=" do segundo lote"
        nomeArea="area_b_id"
        nomeCanteiro="canteiro_b_id"
      />
      {separar !== null && separar > 0 && fica !== null && (
        <div className="flex flex-col gap-1 rounded-lg border border-line p-3 text-base">
          <div className="flex justify-between">
            <span className="text-muted">Primeiro lote</span>
            <span className={`font-bold ${fica < 1 ? 'text-red-700' : 'text-green-800'}`}>{formatQuantidade(fica)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Segundo lote</span>
            <span className="font-bold text-green-800">{formatQuantidade(separar)}</span>
          </div>
          <p className="text-sm text-muted">
            O lote {codigo} encerra, e os dois continuam o protocolo de onde ele estava.
          </p>
        </div>
      )}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        Confirmar divisão
      </Button>
    </form>
  );
}
