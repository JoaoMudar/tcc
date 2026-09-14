'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { lerQuantidade } from '@/lib/lotes-rotulos';
import { CausaPicker } from '../lotes/CausaPicker';
import { type AreaOpcao, AreaCanteiroOpcional } from './AreaCanteiroOpcional';
import { confirmarAtribuicaoAction } from './actions';

interface ConfirmarFormProps {
  atribuicaoId: string;
  exigeLote: boolean;
  eQuantitativa: boolean;
  participantes: readonly { id: string; nome: string }[];
  lotes: readonly SelectOption[];
  areas: readonly AreaOpcao[];
  loteId: string | null;
  areaId: string | null;
  canteiroId: string | null;
}

/**
 * T5.5, UC-20: o lote uma vez, um número por participante só se a tarefa for
 * quantitativa, e as mudas que morreram no mesmo gesto, para a perda não ser esquecida.
 */
export function ConfirmarForm({ atribuicaoId, exigeLote, eQuantitativa, participantes, lotes, areas, loteId, areaId, canteiroId }: ConfirmarFormProps) {
  const [state, formAction, pending] = useActionState(confirmarAtribuicaoAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [perdidas, setPerdidas] = useState(lerQuantidade(fields?.perdidas ?? '') ?? 0);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={atribuicaoId} />
      {exigeLote ? (
        <SelectField label="Lote" name="lote_id" options={lotes} defaultValue={fields?.lote_id ?? loteId ?? ''} required />
      ) : (
        <AreaCanteiroOpcional
          areas={areas}
          defaultAreaId={fields ? fields.area_id : areaId}
          defaultCanteiroId={fields ? fields.canteiro_id : canteiroId}
        />
      )}

      {eQuantitativa && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-gray-700">Quanto cada um fez</legend>
          {participantes.map((p) => (
            <TextField
              key={p.id}
              label={p.nome}
              name={`quantidade_${p.id}`}
              inputMode="numeric"
              autoComplete="off"
              hint="Em branco se ninguém contou."
              defaultValue={fields?.[`quantidade_${p.id}`]}
            />
          ))}
        </fieldset>
      )}

      {exigeLote && (
        <details open={perdidas > 0} className="rounded-xl border border-line">
          <summary className="flex min-h-touch cursor-pointer list-none items-center px-4 text-base font-semibold text-ink">
            Morreu alguma?
          </summary>
          <div className="flex flex-col gap-4 border-t border-line p-4">
            <TextField
              label="Quantas morreram"
              name="perdidas"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={fields?.perdidas}
              onChange={(event) => setPerdidas(lerQuantidade(event.target.value) ?? 0)}
            />
            {perdidas > 0 && <CausaPicker defaultValue={fields?.causa} />}
          </div>
        </details>
      )}

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        Confirmar tarefa
      </Button>
      {exigeLote && (
        <Button type="submit" name="depois" value="repicar" variant="outline" pending={pending}>
          Confirmar e registrar a repicagem
        </Button>
      )}
    </form>
  );
}
