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
  /** Nulo quando o cliente não disse o tamanho: a resposta diz em qual está. */
  recipiente: string | null;
  recipienteId: string | null;
  /** Altura pedida, em metros: é parte do que a gerência vai procurar no pátio. */
  alturaM: number | null;
  /** Nula quando o cliente não disse quantas: a resposta é quantas tem. */
  quantidade: number | null;
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
  recipienteDisponivelId: string | null;
  recipienteDisponivel: string | null;
  observacoesDisponibilidade: string | null;
}

interface VerificacaoItemProps {
  pedidoId: string;
  item: ItemParaConferir;
  recipientes: readonly SelectOption[];
}

type Estado = 'disponivel' | 'parcial' | 'indisponivel';

/** O painel aberto: "tem parte", "tem" (item sem quantidade) ou "tem tudo" sem recipiente. */
type Painel = 'parcial' | 'tem' | 'tudo' | null;

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

function painelInicial(item: ItemParaConferir, atual: Estado | 'pendente'): Painel {
  if (item.quantidade === null) return atual === 'disponivel' ? 'tem' : null;
  if (atual === 'parcial') return 'parcial';
  return atual === 'disponivel' && !item.recipienteId ? 'tudo' : null;
}

/**
 * T8.12: um item, três botões, e cada toque grava. Não há "Salvar" por item de
 * propósito: quem confere está andando no pátio com o celular numa mão, e um
 * botão a mais por item é um item que fica sem resposta.
 *
 * O parcial é o que pede mais: quanto tem e em que recipiente está. Os campos
 * aparecem só quando ele é escolhido, e **gravam sozinhos**: a quantidade ao
 * sair do campo, o recipiente ao ser trocado.
 *
 * **O item que chegou incompleto muda a pergunta.** Sem quantidade ("tem
 * ipê?"), os botões são "Não tem" e "Tem", e o "Tem" pergunta quantas e em que
 * recipiente. Sem recipiente, o "Tem tudo" pergunta em qual está, porque é a
 * única informação de tamanho que o pedido vai ter.
 */
export function VerificacaoItem({ pedidoId, item, recipientes }: VerificacaoItemProps) {
  const [state, formAction, pending] = useActionState(marcarDisponibilidadeAction, EMPTY_FORM_STATE);
  const atual = estadoDe(item);
  const semQuantidade = item.quantidade === null;
  const [painel, setPainel] = useState<Painel>(painelInicial(item, atual));
  const formRef = useRef<HTMLFormElement>(null);
  const [quantidade, setQuantidade] = useState(item.quantidadeDisponivel ? String(item.quantidadeDisponivel) : '');
  const [recipienteId, setRecipienteId] = useState(item.recipienteDisponivelId ?? item.recipienteId ?? '');
  // O que já está no banco, para sair do campo sem mudar nada não regravar
  const gravado = useRef(painelInicial(item, atual) ? `${quantidade}|${recipienteId}` : null);

  function gravar(estado: Estado, proximaQuantidade: string, proximoRecipiente: string) {
    const form = formRef.current;
    if (!form) return;
    if (estado !== 'disponivel' || semQuantidade) {
      if (proximaQuantidade.trim() === '') return;
    }
    if (!proximoRecipiente) return;
    const chave = `${proximaQuantidade.trim()}|${proximoRecipiente}`;
    // Repetir só vale se o banco já tem exatamente isto: depois de erro ou de
    // outra resposta ("Não tem"), o mesmo valor precisa ir de novo
    if (chave === gravado.current && atual !== 'indisponivel' && atual !== 'pendente' && !state.error) return;
    gravado.current = chave;
    const dados = new FormData(form);
    dados.set('estado', estado);
    dados.set('quantidade', proximaQuantidade);
    dados.set('recipiente_id', proximoRecipiente);
    startTransition(() => formAction(dados));
  }

  const estadoDoPainel: Estado = painel === 'parcial' ? 'parcial' : 'disponivel';
  const pedeQuantidade = painel === 'parcial' || painel === 'tem';

  const tamanho = [item.recipiente ?? 'recipiente a definir', item.alturaM ? formatAltura(item.alturaM) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${COR[atual]}`}>
      <div>
        <p className="text-base font-bold text-ink">{item.especie}</p>
        <p className="text-sm text-muted">
          {tamanho} · {semQuantidade ? 'quantidade a definir' : formatQuantidade(item.quantidade!)}
        </p>
      </div>

      {atual === 'parcial' && item.quantidadeDisponivel !== null && (
        <p className="text-sm font-semibold text-amber-900">
          Tem {formatQuantidade(item.quantidadeDisponivel)} de {formatQuantidade(item.quantidade ?? 0)}
        </p>
      )}
      {atual === 'indisponivel' && <p className="text-sm font-semibold text-red-800">Não tem no viveiro</p>}
      {atual === 'disponivel' && (
        <p className="text-sm font-semibold text-green-800">
          {semQuantidade ? `Tem ${formatQuantidade(item.quantidadeDisponivel ?? 0)}` : 'Tem tudo'}
          {item.recipienteDisponivel ? `, em ${item.recipienteDisponivel}` : ''}
        </p>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <input type="hidden" name="item_id" value={item.id} />

        <div className={`grid gap-2 ${semQuantidade ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <Button
            type="submit"
            name="estado"
            value="indisponivel"
            variant="secondary"
            pending={pending}
            pendingLabel="…"
            onClick={() => setPainel(null)}
          >
            Não tem
          </Button>
          {semQuantidade ? (
            <Button type="button" variant={painel === 'tem' ? 'primary' : 'outline'} onClick={() => setPainel('tem')}>
              Tem
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant={painel === 'parcial' ? 'primary' : 'secondary'}
                onClick={() => setPainel('parcial')}
              >
                Tem parte
              </Button>
              {item.recipienteId ? (
                <Button
                  type="submit"
                  name="estado"
                  value="disponivel"
                  variant="outline"
                  pending={pending}
                  pendingLabel="…"
                  onClick={() => setPainel(null)}
                >
                  Tem tudo
                </Button>
              ) : (
                <Button
                  type="button"
                  variant={painel === 'tudo' ? 'primary' : 'outline'}
                  onClick={() => setPainel('tudo')}
                >
                  Tem tudo
                </Button>
              )}
            </>
          )}
        </div>

        {painel && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-400 bg-white p-3">
            {pedeQuantidade && (
              <TextField
                label={semQuantidade ? 'Quantas tem' : 'Quantas existem'}
                name="quantidade"
                inputMode="numeric"
                autoComplete="off"
                value={quantidade}
                onChange={(evento) => setQuantidade(evento.target.value)}
                onBlur={() => gravar(estadoDoPainel, quantidade, recipienteId)}
                hint={semQuantidade ? undefined : `Menos que ${formatQuantidade(item.quantidade!)}`}
              />
            )}
            {/* Pode ser outro recipiente: achou em saco o que foi pedido em tubete */}
            <SelectField
              label="Em que recipiente está"
              name="recipiente_id"
              options={recipientes}
              value={recipienteId}
              onChange={(evento) => {
                setRecipienteId(evento.target.value);
                gravar(estadoDoPainel, quantidade, evento.target.value);
              }}
            />
            <p className="text-sm text-muted" aria-live="polite">
              {pending
                ? 'Gravando…'
                : atual !== 'pendente' && atual !== 'indisponivel' && !state.error
                  ? 'Gravado.'
                  : 'Grava ao sair do campo.'}
            </p>
          </div>
        )}

        <TextField
          label="Observação"
          name="observacoes"
          maxLength={500}
          defaultValue={item.observacoesDisponibilidade ?? ''}
        />

        {state.error && <Notice tone="error">{state.error}</Notice>}
      </form>
    </li>
  );
}
