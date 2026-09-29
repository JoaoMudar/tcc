'use client';

import { useRegistroCampo } from '@/components/useRegistroCampo';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { CausaPicker } from '../CausaPicker';

/**
 * F1 UC-25, T4.5: quantidade, causa e observação. Espécie, recipiente e canteiro
 * vêm do lote (RF-37). Funciona sem rede: fica no aparelho e vai depois (TA-23).
 */
export function PerdaForm({ loteId, codigo, saldo }: { loteId: string; codigo: string; saldo: number }) {
  const [state, formAction, pending] = useRegistroCampo('perda', {
    rotulo: (campos) => `Perda de ${campos.quantidade} no lote ${codigo}`,
  });
  const fields = state.error ? state.fields : undefined;

  return (
    <form key={state.rodada ?? 'perda'} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="lote_id" value={loteId} />
      <TextField
        label="Quantidade perdida"
        name="quantidade"
        inputMode="numeric"
        autoComplete="off"
        hint={`O lote tem ${formatQuantidade(saldo)} mudas.`}
        defaultValue={fields?.quantidade}
        required
      />
      <CausaPicker defaultValue={fields?.causa} />
      <TextField label="Observação" name="observacoes" maxLength={500} defaultValue={fields?.observacoes} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      {state.guardado && <Notice tone="warning">{state.guardado}</Notice>}
      <Button type="submit" pending={pending}>
        Registrar perda
      </Button>
    </form>
  );
}
