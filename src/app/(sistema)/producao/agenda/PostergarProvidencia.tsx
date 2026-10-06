'use client';

import { useActionState, useEffect, useState } from 'react';
import { formatData, hojeNoViveiro } from '@/lib/datas';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { MAX_DIAS_ADIAMENTO } from '@/lib/protocolo-rotulos';
import { type Providencia, prazoAdiado } from '@/lib/providencia';
import { adiarAtribuicaoAction, adiarEtapaAction } from './actions';

interface PostergarProvidenciaProps {
  providencia: Providencia;
  onVoltar: () => void;
  onFeito: (texto: string) => void;
}

/** Os prazos que se pedem de verdade: tocados, não digitados (RNF-02). */
export const ATALHOS_DIAS = [1, 2, 3, 7, 15, 30] as const;

const PASSO =
  'inline-flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-line text-2xl font-bold text-ink active:bg-surface disabled:opacity-40';

function limitar(dias: number): number {
  return Math.min(MAX_DIAS_ADIAMENTO, Math.max(1, dias));
}

/**
 * RF-66: quantos dias postergar. Os atalhos resolvem quase sempre; o − e o +
 * acertam o resto sem teclado. O novo prazo aparece antes de confirmar, e conta
 * de hoje quando o prazo já passou.
 */
export function PostergarProvidencia({ providencia: p, onVoltar, onFeito }: PostergarProvidenciaProps) {
  const etapa = p.origem.tipo === 'etapa' ? p.origem : null;
  const [estado, adiar, adiando] = useActionState(etapa ? adiarEtapaAction : adiarAtribuicaoAction, EMPTY_FORM_STATE);
  const [dias, setDias] = useState(7);
  // O painel só abre depois do toque: ler o relógio aqui não desencontra do servidor
  const novoPrazo = prazoAdiado(p.prazo, dias, hojeNoViveiro());

  useEffect(() => {
    if (estado.success) onFeito(estado.success);
  }, [estado.success, onFeito]);

  return (
    <form action={adiar} className="flex flex-col gap-4">
      {etapa ? (
        <>
          <input type="hidden" name="lote_id" value={etapa.loteId} />
          <input type="hidden" name="etapa_id" value={etapa.etapaId} />
        </>
      ) : (
        p.origem.tipo === 'tarefa' && <input type="hidden" name="id" value={p.origem.atribuicaoId} />
      )}
      <input type="hidden" name="dias" value={dias} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-gray-700">Postergar por</legend>
        <div className="grid grid-cols-3 gap-2">
          {ATALHOS_DIAS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={dias === n}
              onClick={() => setDias(n)}
              className="inline-flex min-h-touch items-center justify-center rounded-xl border-[1.5px] border-gray-300 bg-white text-base text-ink aria-pressed:border-brand-dark aria-pressed:bg-brand-light aria-pressed:font-semibold"
            >
              {n} {n === 1 ? 'dia' : 'dias'}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3">
        <button type="button" aria-label="Um dia a menos" disabled={dias <= 1} onClick={() => setDias((d) => limitar(d - 1))} className={PASSO}>
          −
        </button>
        <p aria-live="polite" className="text-center">
          <span className="block text-3xl font-bold text-ink tabular-nums">{dias}</span>
          <span className="text-sm text-muted">{dias === 1 ? 'dia' : 'dias'}</span>
        </p>
        <button
          type="button"
          aria-label="Um dia a mais"
          disabled={dias >= MAX_DIAS_ADIAMENTO}
          onClick={() => setDias((d) => limitar(d + 1))}
          className={PASSO}
        >
          +
        </button>
      </div>
      {novoPrazo && <p className="text-center text-base text-muted">Novo prazo: {formatData(novoPrazo)}</p>}

      {estado.error && (
        <p role="alert" className="text-sm text-red-800">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={adiando}
        className="inline-flex min-h-touch w-full items-center justify-center rounded-xl bg-brand px-4 text-base font-bold text-white active:bg-brand-dark disabled:opacity-60"
      >
        {adiando ? 'Postergando…' : `Postergar ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
      </button>
      <button type="button" onClick={onVoltar} className="min-h-touch text-base font-semibold text-brand-dark">
        Voltar
      </button>
    </form>
  );
}
