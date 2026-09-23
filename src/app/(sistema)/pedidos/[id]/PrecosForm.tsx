'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { formatTotal, parsePreco, precoParaCampo, totalPedido } from '@/lib/pedidos-rotulos';
import { negociarItensAction } from '../actions';

export interface ItemParaNegociar {
  id: string;
  especie: string;
  /** O genérico com quantidade só recebe preço: a soma dos filhos é dele. */
  generico: boolean;
  /** O que a conferência confirmou: o teto da quantidade. */
  confirmada: number;
  precoCentavos: number | null;
  /** O recipiente pedido e o conferido, quando diferem. Um só não é escolha. */
  recipientes: readonly SelectOption[];
  recipienteId: string;
}

interface PrecosFormProps {
  pedidoId: string;
  itens: readonly ItemParaNegociar[];
}

interface Valores {
  preco: string;
  quantidade: string;
  recipienteId: string;
}

/**
 * RF-55, RN-50: a negociação, depois da conferência. É aqui que a chefia fecha
 * a venda com o cliente sabendo o que a gerência achou no pátio: por quanto,
 * quantas (até o que foi confirmado, e zero tira o item) e em que recipiente,
 * quando a conferência achou a muda em outro.
 *
 * O total aparece ao vivo enquanto se digita, e diz "a definir" enquanto faltar
 * preço em algum item, que é exatamente o que a aprovação vai recusar.
 *
 * **Não há botão de salvar**: grava ao sair do campo, se mudou. O formulário
 * vai inteiro, porque a action lê as listas paralelas, e a quantidade já vem
 * preenchida com a confirmada: gravá-la é a chefia concordando com ela.
 */
export function PrecosForm({ pedidoId, itens }: PrecosFormProps) {
  const [state, formAction, pending] = useActionState(negociarItensAction, EMPTY_FORM_STATE);
  const [valores, setValores] = useState<Record<string, Valores>>(() =>
    Object.fromEntries(
      itens.map((item) => [
        item.id,
        {
          preco: item.precoCentavos === null ? '' : precoParaCampo(item.precoCentavos),
          quantidade: item.generico ? '' : String(item.confirmada),
          recipienteId: item.recipienteId,
        },
      ]),
    ),
  );

  const formRef = useRef<HTMLFormElement>(null);
  const gravados = useRef(JSON.stringify(valores));

  function gravarSeMudou(proximos: Record<string, Valores> = valores) {
    const form = formRef.current;
    const serial = JSON.stringify(proximos);
    if (!form || (serial === gravados.current && !state.error)) return;
    gravados.current = serial;
    startTransition(() => formAction(new FormData(form)));
  }

  function alterar(itemId: string, campo: keyof Valores, valor: string) {
    const proximos = { ...valores, [itemId]: { ...valores[itemId], [campo]: valor } };
    setValores(proximos);
    return proximos;
  }

  const calculaveis = itens.map((item) => {
    const preco = parsePreco(valores[item.id]?.preco ?? '');
    const quantidade = item.generico ? item.confirmada : lerQuantidade(valores[item.id]?.quantidade ?? '');
    return { quantidade, precoCentavos: 'value' in preco ? preco.value : null };
  });

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Negociação</h2>
      <p className="text-sm text-muted">
        A conferência já disse o que existe. Informe por quanto cada muda foi vendida e quantas o cliente leva.
      </p>
      <input type="hidden" name="pedido_id" value={pedidoId} />

      <ul className="flex flex-col gap-4">
        {itens.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 border-b border-line pb-3 last:border-b-0">
            <p className="text-base font-semibold text-ink">{item.especie}</p>
            <input type="hidden" name="negociar_item_id" value={item.id} />
            <div className="grid grid-cols-2 gap-2">
              {item.generico ? (
                <p className="self-end text-sm text-muted">
                  {formatQuantidade(item.confirmada)}
                  <input type="hidden" name="negociar_quantidade" value="" />
                </p>
              ) : (
                <TextField
                  label="Quantidade"
                  name="negociar_quantidade"
                  inputMode="numeric"
                  autoComplete="off"
                  hint={`Até ${formatQuantidade(item.confirmada)}. Zero tira o item.`}
                  value={valores[item.id]?.quantidade ?? ''}
                  onChange={(event) => alterar(item.id, 'quantidade', event.target.value)}
                  onBlur={() => gravarSeMudou()}
                />
              )}
              <TextField
                label="Preço da muda"
                name="negociar_preco"
                inputMode="decimal"
                autoComplete="off"
                placeholder="12,50"
                value={valores[item.id]?.preco ?? ''}
                onChange={(event) => alterar(item.id, 'preco', event.target.value)}
                onBlur={() => gravarSeMudou()}
              />
            </div>
            {item.recipientes.length > 1 ? (
              <SelectField
                label="Recipiente"
                name="negociar_recipiente"
                options={item.recipientes}
                value={valores[item.id]?.recipienteId ?? ''}
                onChange={(event) => gravarSeMudou(alterar(item.id, 'recipienteId', event.target.value))}
              />
            ) : (
              <>
                <input type="hidden" name="negociar_recipiente" value="" />
                {item.recipientes[0] && <p className="text-sm text-muted">{item.recipientes[0].label}</p>}
              </>
            )}
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
