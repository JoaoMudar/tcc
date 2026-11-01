'use client';

import { useActionState, useRef, useState } from 'react';
import { Notice } from '@/components/ui/Notice';
import { SelectField, type SelectOption } from '@/components/ui/SelectField';
import { EMPTY_FORM_STATE, type FormState } from '@/lib/form-state';

interface EscolhaDoLoteProps {
  pedidoId: string;
  cargaItemId: string;
  loteId: string | null;
  /** Código do lote gravado, para mostrá-lo mesmo depois de zerado e fora das opções. */
  loteCodigo?: string | null;
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
 *
 * O `<form action>` do React 19 reinicia o formulário depois de gravar, e o
 * select volta à opção com que foi montado. Por isso ele remonta a cada
 * escolha (`key`), já com o lote novo como o de partida.
 */
export function EscolhaDoLote({
  pedidoId,
  cargaItemId,
  loteId,
  loteCodigo = null,
  opcoes,
  action,
  travado = false,
}: EscolhaDoLoteProps) {
  const [state, gravar] = useActionState(action, EMPTY_FORM_STATE);
  const form = useRef<HTMLFormElement>(null);
  const [escolhido, setEscolhido] = useState(loteId ?? '');
  // O servidor manda outro lote (outra pessoa trocou, ou a página recarregou): vale o dele
  const [doServidor, setDoServidor] = useState(loteId);
  if (loteId !== doServidor) {
    setDoServidor(loteId);
    setEscolhido(loteId ?? '');
  }

  // O lote gravado que zerou (a venda saiu dele) já não está entre os abertos, mas é dele que saiu
  const lista =
    loteId && loteCodigo && !opcoes.some((o) => o.value === loteId)
      ? [{ value: loteId, label: loteCodigo }, ...opcoes]
      : opcoes;

  if (lista.length === 0) {
    return <p className="text-xs text-muted">Sem estoque.</p>;
  }

  return (
    <form ref={form} action={gravar} className="flex flex-col gap-1">
      <input type="hidden" name="pedido_id" value={pedidoId} />
      <input type="hidden" name="carga_item_id" value={cargaItemId} />
      <SelectField
        key={escolhido}
        label="Sai do lote"
        name="lote_id"
        options={lista}
        placeholder="Escolha o lote…"
        defaultValue={escolhido}
        disabled={travado}
        onChange={(evento) => {
          setEscolhido(evento.currentTarget.value);
          form.current?.requestSubmit();
        }}
      />
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
