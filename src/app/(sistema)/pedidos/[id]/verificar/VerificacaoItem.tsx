'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { formatAltura } from '@/lib/pedidos-rotulos';
import { marcarDisponibilidadeAction } from './actions';

export interface ItemParaConferir {
  id: string;
  especie: string;
  recipiente: string;
  recipienteId: string;
  /** Altura pedida, em metros: é parte do que a gerência vai procurar no pátio. */
  alturaM: number | null;
  quantidade: number;
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
  recipienteDisponivelId: string | null;
  observacoesDisponibilidade: string | null;
}

interface VerificacaoItemProps {
  pedidoId: string;
  item: ItemParaConferir;
  recipientes: readonly SelectOption[];
}

type Estado = 'disponivel' | 'parcial' | 'indisponivel';

/** Branco é o que ainda não foi olhado, e é o que a pessoa procura na tela. */
const COR: Record<Estado | 'pendente', string> = {
  disponivel: 'border-green-600 bg-green-50',
  parcial: 'border-amber-500 bg-amber-50',
  indisponivel: 'border-red-600 bg-red-50',
  pendente: 'border-line bg-white',
};

function estadoDe(item: ItemParaConferir): Estado | 'pendente' {
  if (item.disponivel === null) return 'pendente';
  if (item.disponivel) return 'disponivel';
  return item.quantidadeDisponivel && item.quantidadeDisponivel > 0 ? 'parcial' : 'indisponivel';
}

/**
 * T8.12: um item, três botões, e cada toque grava. Não há "Salvar" por item de
 * propósito: quem confere está andando no pátio com o celular numa mão, e um
 * botão a mais por item é um item que fica sem resposta.
 *
 * O parcial é o único que pede mais: quanto tem e em que recipiente está. Os
 * dois campos aparecem só quando ele é escolhido, e **gravam sozinhos**: a
 * quantidade ao sair do campo, o recipiente ao ser trocado. Botão de gravar ali
 * seria o passo que se esquece antes de ir ao próximo item.
 */
export function VerificacaoItem({ pedidoId, item, recipientes }: VerificacaoItemProps) {
  const [state, formAction, pending] = useActionState(marcarDisponibilidadeAction, EMPTY_FORM_STATE);
  const atual = estadoDe(item);
  const [abrirParcial, setAbrirParcial] = useState(atual === 'parcial');
  const formRef = useRef<HTMLFormElement>(null);
  const [quantidade, setQuantidade] = useState(item.quantidadeDisponivel ? String(item.quantidadeDisponivel) : '');
  const [recipienteId, setRecipienteId] = useState(item.recipienteDisponivelId ?? item.recipienteId);
  // O que já está no banco, para sair do campo sem mudar nada não regravar
  const gravado = useRef(atual === 'parcial' ? `${quantidade}|${recipienteId}` : null);

  function gravarParcial(proximaQuantidade: string, proximoRecipiente: string) {
    const form = formRef.current;
    const chave = `${proximaQuantidade.trim()}|${proximoRecipiente}`;
    if (!form || proximaQuantidade.trim() === '') return;
    // Repetir só vale se o banco já tem exatamente isto: depois de erro ou de
    // outra resposta ("Não tem"), o mesmo valor precisa ir de novo
    if (chave === gravado.current && atual === 'parcial' && !state.error) return;
    gravado.current = chave;
    const dados = new FormData(form);
    dados.set('estado', 'parcial');
    dados.set('quantidade', proximaQuantidade);
    dados.set('recipiente_id', proximoRecipiente);
    startTransition(() => formAction(dados));
  }

  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${COR[atual]}`}>
      <div>
        <p className="text-base font-bold text-ink">{item.especie}</p>
        <p className="text-sm text-muted">
          {item.recipiente}
          {item.alturaM ? ` · ${formatAltura(item.alturaM)}` : ''} · {formatQuantidade(item.quantidade)}
        </p>
      </div>

      {atual === 'parcial' && item.quantidadeDisponivel !== null && (
        <p className="text-sm font-semibold text-amber-900">
          Tem {formatQuantidade(item.quantidadeDisponivel)} de {formatQuantidade(item.quantidade)}
        </p>
      )}
      {atual === 'indisponivel' && <p className="text-sm font-semibold text-red-800">Não tem no viveiro</p>}
      {atual === 'disponivel' && <p className="text-sm font-semibold text-green-800">Tem tudo</p>}

      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <input type="hidden" name="item_id" value={item.id} />

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="submit"
            name="estado"
            value="indisponivel"
            variant="secondary"
            pending={pending}
            pendingLabel="…"
            onClick={() => setAbrirParcial(false)}
          >
            Não tem
          </Button>
          <Button type="button" variant={abrirParcial ? 'primary' : 'secondary'} onClick={() => setAbrirParcial(true)}>
            Tem parte
          </Button>
          <Button
            type="submit"
            name="estado"
            value="disponivel"
            variant="outline"
            pending={pending}
            pendingLabel="…"
            onClick={() => setAbrirParcial(false)}
          >
            Tem tudo
          </Button>
        </div>

        {abrirParcial && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-400 bg-white p-3">
            <TextField
              label="Quantas existem"
              name="quantidade"
              inputMode="numeric"
              autoComplete="off"
              value={quantidade}
              onChange={(evento) => setQuantidade(evento.target.value)}
              onBlur={() => gravarParcial(quantidade, recipienteId)}
              hint={`Menos que ${formatQuantidade(item.quantidade)}`}
            />
            {/* Pode ser outro recipiente: achou em saco o que foi pedido em tubete */}
            <SelectField
              label="Em que recipiente está"
              name="recipiente_id"
              options={recipientes}
              value={recipienteId}
              onChange={(evento) => {
                setRecipienteId(evento.target.value);
                gravarParcial(quantidade, evento.target.value);
              }}
            />
            <p className="text-sm text-muted" aria-live="polite">
              {pending ? 'Gravando…' : atual === 'parcial' && !state.error ? 'Gravado.' : 'Grava ao sair do campo.'}
            </p>
          </div>
        )}

        <TextField
          label="Observação (opcional)"
          name="observacoes"
          maxLength={500}
          defaultValue={item.observacoesDisponibilidade ?? ''}
        />

        {state.error && <Notice tone="error">{state.error}</Notice>}
      </form>
    </li>
  );
}
