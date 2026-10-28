'use client';

import { useActionState, useRef } from 'react';
import { Notice } from '@/components/ui/Notice';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { EMPTY_FORM_STATE, type FormState } from '@/lib/form-state';

interface EscolhaDoLoteProps {
  pedidoId: string;
  cargaItemId: string;
  loteId: string | null;
  opcoes: readonly SelectOption[];
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  /** Carga pronta ou viagem concluída: mostra o lote, sem trocar. */
  travado?: boolean;
}

/**
 * RF-24: de que lote saem as mudas deste item. Vem sugerido ao criar a carga
 * (mesma espécie e recipiente, altura mais próxima), e grava ao trocar, sem
 * botão: quem está no pátio olha o canteiro e corrige. A conclusão da viagem
 * baixa a venda neste lote.
 */
export function EscolhaDoLote({ pedidoId, cargaItemId, loteId, opcoes, action, travado = false }: EscolhaDoLoteProps) {
  const [state, gravar] = useActionState(action, EMPTY_FORM_STATE);
  const form = useRef<HTMLFormElement>(null);

  if (opcoes.length === 0) {
    return <Notice tone="error">Nenhum lote aberto desta espécie e recipiente: a venda não terá de onde sair.</Notice>;
  }

  return (
    <form ref={form} action={gravar} className="flex flex-col gap-1">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <input type="hidden" name="carga_item_id" value={cargaItemId} />
      <SelectField
        label="Sai do lote"
        name="lote_id"
        options={opcoes}
        placeholder="Escolha o lote…"
        defaultValue={loteId ?? ''}
        disabled={travado}
        onChange={() => form.current?.requestSubmit()}
      />
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
