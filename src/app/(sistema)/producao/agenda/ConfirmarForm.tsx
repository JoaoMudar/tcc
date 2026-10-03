'use client';

import { useState } from 'react';
import { useRegistroCampo } from '@/components/useRegistroCampo';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { UnidadeTarefa } from '@/lib/agenda-rotulos';
import { lerQuantidade } from '@/lib/lotes-rotulos';
import { CausaPicker } from '../lotes/CausaPicker';
import { type AreaOpcao, AreaCanteiroOpcional } from './AreaCanteiroOpcional';

interface ConfirmarFormProps {
  atribuicaoId: string;
  /** Como a tarefa aparece na fila do aparelho: "Plantio, 14/09/2026". */
  descricao: string;
  exigeLote: boolean;
  exigeArea: boolean;
  eQuantitativa: boolean;
  unidadeMedida: UnidadeTarefa;
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
 * Sem rede fica no aparelho e vai depois (UC-20 FA-3). Confirmada, volta à agenda do dia.
 */
export function ConfirmarForm({
  atribuicaoId,
  descricao,
  exigeLote,
  exigeArea,
  eQuantitativa,
  unidadeMedida,
  participantes,
  lotes,
  areas,
  loteId,
  areaId,
  canteiroId,
}: ConfirmarFormProps) {
  const [state, formAction, pending] = useRegistroCampo('confirmacao_tarefa', {
    rotulo: () => `Confirmação: ${descricao}`,
  });
  const fields = state.error ? state.fields : undefined;
  const [perdidas, setPerdidas] = useState(lerQuantidade(fields?.perdidas ?? '') ?? 0);

  // A tarefa confirma uma vez só: guardada no aparelho, o formulário sai para não ser confirmada de novo
  if (state.guardado) return <Notice tone="warning">{state.guardado}</Notice>;

  return (
    <form key={state.rodada ?? 'confirmar'} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={atribuicaoId} />
      {exigeLote && (
        <SelectField label="Lote" name="lote_id" options={lotes} defaultValue={fields?.lote_id ?? loteId ?? ''} required />
      )}
      {exigeArea && !exigeLote && (
        <AreaCanteiroOpcional
          areas={areas}
          defaultAreaId={fields ? fields.area_id : areaId}
          defaultCanteiroId={fields ? fields.canteiro_id : canteiroId}
        />
      )}

      {eQuantitativa && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold text-gray-700">Quanto cada um fez ({unidadeMedida})</legend>
          {participantes.map((p) => (
            <TextField
              key={p.id}
              label={p.nome}
              name={`quantidade_${p.id}`}
              inputMode={unidadeMedida === 'un' ? 'numeric' : 'decimal'}
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
    </form>
  );
}
