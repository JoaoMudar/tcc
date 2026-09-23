'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { formatTotal, parsePreco, precoParaCampo, totalPedido } from '@/lib/pedidos-rotulos';
import { definirPrecosAction } from '../actions';

export interface ItemParaPrecificar {
  id: string;
  especie: string;
  recipiente: string;
  quantidade: number;
  precoCentavos: number | null;
}

interface PrecosFormProps {
  pedidoId: string;
  itens: readonly ItemParaPrecificar[];
}

/**
 * RF-55, RN-50: o preço da venda, digitado depois da conferência.
 *
 * É aqui que a chefia fecha o valor, sabendo o que a gerência achou no pátio.
 * O total aparece ao vivo enquanto se digita, e diz "a definir" enquanto faltar
 * preço em algum item, que é exatamente o que a aprovação vai recusar.
 *
 * **Não há botão de salvar**: o preço grava ao sair do campo, se mudou. O
 * formulário vai inteiro, porque a action lê as listas paralelas, e campo em
 * branco é item ainda sem preço, que ela pula.
 */
export function PrecosForm({ pedidoId, itens }: PrecosFormProps) {
  const [state, formAction, pending] = useActionState(definirPrecosAction, EMPTY_FORM_STATE);
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(itens.map((item) => [item.id, item.precoCentavos === null ? '' : precoParaCampo(item.precoCentavos)])),
  );

  const formRef = useRef<HTMLFormElement>(null);
  const gravados = useRef<Record<string, string>>({ ...valores });

  function gravarSeMudou(itemId: string) {
    const form = formRef.current;
    const valor = (valores[itemId] ?? '').trim();
    if (!form || (valor === (gravados.current[itemId] ?? '').trim() && !state.error)) return;
    // Tudo em branco não tem o que gravar, e a action recusaria
    if (Object.values(valores).every((texto) => texto.trim() === '')) return;
    gravados.current = { ...valores };
    startTransition(() => formAction(new FormData(form)));
  }

  const calculaveis = itens.map((item) => {
    const preco = parsePreco(valores[item.id] ?? '');
    return { quantidade: item.quantidade, precoCentavos: 'value' in preco ? preco.value : null };
  });

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Preço da venda</h2>
      <p className="text-sm text-muted">
        A conferência já disse o que existe. Informe por quanto cada muda foi vendida.
      </p>
      <input type="hidden" name="pedido_id" value={pedidoId} />

      <ul className="flex flex-col gap-3">
        {itens.map((item) => (
          <li key={item.id} className="flex flex-col gap-1">
            <input type="hidden" name="preco_item_id" value={item.id} />
            <TextField
              label={item.especie}
              name="preco_valor"
              inputMode="decimal"
              autoComplete="off"
              placeholder="12,50"
              hint={`${item.recipiente} · ${formatQuantidade(item.quantidade)}`}
              value={valores[item.id] ?? ''}
              onChange={(event) => setValores((atuais) => ({ ...atuais, [item.id]: event.target.value }))}
              onBlur={() => gravarSeMudou(item.id)}
            />
          </li>
        ))}
      </ul>

      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="text-base text-muted">Total do pedido</span>
        <span className="text-2xl font-bold text-ink">{formatTotal(totalPedido(calculaveis))}</span>
      </div>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      {pending ? (
        <p className="text-sm text-muted" aria-live="polite">
          Salvando…
        </p>
      ) : (
        state.success && <Notice tone="success">{state.success}</Notice>
      )}
    </form>
  );
}
