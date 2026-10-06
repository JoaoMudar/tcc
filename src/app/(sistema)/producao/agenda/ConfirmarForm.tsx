'use client';

import { useRegistroCampo } from '@/components/useRegistroCampo';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { UnidadeTarefa } from '@/lib/agenda-rotulos';
import { type AreaOpcao, AreaCanteiroOpcional } from './AreaCanteiroOpcional';
import { PerdaNaConfirmacao } from './PerdaNaConfirmacao';

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

      {exigeLote && <PerdaNaConfirmacao perdidas={fields?.perdidas} causa={fields?.causa} />}

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        Confirmar tarefa
      </Button>
    </form>
  );
}
