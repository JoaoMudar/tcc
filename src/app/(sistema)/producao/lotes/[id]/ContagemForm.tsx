'use client';

import { useState } from 'react';
import { type EstadoRegistro, useRegistroCampo } from '@/components/useRegistroCampo';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';

const PERCENTUAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/**
 * F1 UC-26, T4.6: o contado substitui o calculado, e a diferença aparece antes de
 * confirmar (RN-09). Sem rede fica no aparelho, e a diferença é refeita contra o
 * saldo da hora em que chegar: a contagem diz quantas há, e é isso que vale.
 */
export function ContagemForm({ loteId, codigo, saldo }: { loteId: string; codigo: string; saldo: number }) {
  const [state, formAction, pending] = useRegistroCampo('contagem', {
    rotulo: (campos) => `Contagem de ${campos.contado} no lote ${codigo}`,
    complementoGuardado: () => 'A diferença é calculada quando chegar, contra o saldo daquela hora.',
  });
  // A chave recria os campos depois de gravar, e com eles a diferença calculada
  return <Campos key={state.rodada ?? 'contagem'} loteId={loteId} saldo={saldo} state={state} formAction={formAction} pending={pending} />;
}

interface CamposProps {
  loteId: string;
  saldo: number;
  state: EstadoRegistro;
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
      <TextField label="Observação" name="observacoes" maxLength={500} defaultValue={fields?.observacoes} />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      {state.guardado && <Notice tone="warning">{state.guardado}</Notice>}
      <Button type="submit" pending={pending}>
        Confirmar contagem
      </Button>
    </form>
  );
}
