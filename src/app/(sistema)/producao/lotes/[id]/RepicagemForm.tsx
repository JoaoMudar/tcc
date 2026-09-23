'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { type CanteiroResumo, formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { CanteiroPicker } from '../CanteiroPicker';
import { CausaPicker } from '../CausaPicker';
import { repicarLoteAction } from '../actions';

interface RepicagemFormProps {
  loteId: string;
  codigo: string;
  saldo: number;
  /** Recipientes em uso, menos o do próprio lote. */
  recipientes: readonly SelectOption[];
  canteiros: readonly CanteiroResumo[];
  /** A tarefa de repicagem confirmada na agenda, quando se chega por ela (UC-20 FA-1). */
  atribuicaoId?: string | null;
}

/** F1 UC-23, T4.8: quantas repicar, para qual recipiente e canteiro; as que morreram viram perda do lote (RN-27). */
export function RepicagemForm({ loteId, codigo, saldo, recipientes, canteiros, atribuicaoId = null }: RepicagemFormProps) {
  const [state, formAction, pending] = useActionState(repicarLoteAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [repicar, setRepicar] = useState<number | null>(lerQuantidade(fields?.quantidade ?? ''));
  const [perdidas, setPerdidas] = useState<number>(lerQuantidade(fields?.perdidas ?? '') ?? 0);
  const fica = saldo - (repicar ?? 0) - perdidas;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lote_id" value={loteId} />
      {atribuicaoId && <input type="hidden" name="atribuicao_id" value={atribuicaoId} />}
      <TextField
        label="Quantas repicar"
        name="quantidade"
        inputMode="numeric"
        autoComplete="off"
        hint={`O lote tem ${formatQuantidade(saldo)} mudas.`}
        defaultValue={fields?.quantidade}
        onChange={(event) => setRepicar(lerQuantidade(event.target.value))}
        required
      />
      <SelectField label="Para o recipiente" name="recipiente_id" options={recipientes} defaultValue={fields?.recipiente_id} required />
      <CanteiroPicker
        canteiros={canteiros}
        quantidade={repicar}
        defaultAreaId={fields?.area_id}
        defaultCanteiroId={fields?.canteiro_id}
        sufixo=" de destino"
      />
      <TextField
        label="Morreram na repicagem"
        name="perdidas"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={fields?.perdidas}
        onChange={(event) => setPerdidas(lerQuantidade(event.target.value) ?? 0)}
      />
      {perdidas > 0 && <CausaPicker legenda="Causa das que morreram" defaultValue={fields?.causa} />}
      {repicar !== null && repicar > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-line p-3 text-base">
          <div className="flex justify-between">
            <span className="text-muted">Lote {codigo} fica com</span>
            <span className={`font-bold ${fica < 0 ? 'text-red-700' : 'text-ink'}`}>{formatQuantidade(fica)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Lote novo</span>
            <span className="font-bold text-green-800">{formatQuantidade(repicar)}</span>
          </div>
        </div>
      )}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        Confirmar repicagem
      </Button>
    </form>
  );
}
