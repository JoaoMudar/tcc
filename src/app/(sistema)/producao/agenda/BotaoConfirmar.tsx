'use client';

import Link from 'next/link';
import { useRegistroCampo } from '@/components/useRegistroCampo';
import type { AtribuicaoResumo } from '@/lib/agenda';
import { confirmavelNumToque, estadoTarefa } from '@/lib/agenda-rotulos';
import { formatData } from '@/lib/datas';
import { IconeEstado } from './IconeEstado';

interface BotaoConfirmarProps {
  atribuicao: AtribuicaoResumo;
  podeConfirmar: boolean;
}

const CAIXA = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2';

/**
 * RF-29 no celular: marcar feito leva um toque. Só quando a confirmação não tem
 * o que perguntar (`confirmavelNumToque`); a quantitativa, ou a que exige lote
 * que ela não tem, leva à ficha, onde está o formulário inteiro. Passa pela fila
 * do aparelho, como a confirmação da ficha: sem rede, fica guardada (RNF-05).
 */
export function BotaoConfirmar({ atribuicao: a, podeConfirmar }: BotaoConfirmarProps) {
  const [state, formAction, pending] = useRegistroCampo('confirmacao_tarefa', {
    rotulo: () => `Confirmação: ${a.tipo}, ${formatData(a.data)}`,
  });
  const estado = estadoTarefa(a);

  if (estado !== 'planejada') {
    return (
      <span className={`${CAIXA} border-transparent text-lg`}>
        <IconeEstado estado={estado} />
      </span>
    );
  }
  if (!podeConfirmar || a.semanaSituacao !== 'aberta' || a.participantes.length === 0) return null;

  if (!confirmavelNumToque(a)) {
    return (
      <Link
        href={`/producao/agenda/${a.id}`}
        aria-label={`Confirmar ${a.tipo}: abre a ficha para informar ${a.eQuantitativa ? 'a quantidade' : 'o lote'}`}
        className={`${CAIXA} border-line text-base text-muted active:bg-brand-light`}
      >
        <span aria-hidden>…</span>
      </Link>
    );
  }

  if (state.guardado) {
    return (
      <span role="img" aria-label={state.guardado} title={state.guardado} className={`${CAIXA} border-atencao text-atencao`}>
        ⏳
      </span>
    );
  }
  // O toque já disse "feito": o ✓ aparece antes da resposta, e a lista se atualiza depois
  const marcado = pending || Boolean(state.success);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={a.id} />
      {a.exigeLote && a.loteId && <input type="hidden" name="lote_id" value={a.loteId} />}
      <input type="hidden" name="depois" value="ficar" />
      <button
        type="submit"
        disabled={marcado}
        aria-label={state.error ? `Tentar de novo: ${state.error}` : `Marcar ${a.tipo} como feita`}
        title={state.error}
        className={`${CAIXA} text-lg font-bold ${
          marcado ? 'border-feito bg-feito text-white' : state.error ? 'border-nao-feito text-nao-feito' : 'border-gray-300 text-transparent'
        } active:bg-brand-light`}
      >
        {state.error ? '!' : '✓'}
      </button>
    </form>
  );
}
