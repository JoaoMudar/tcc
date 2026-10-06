'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { Providencia } from '@/lib/providencia';
import { PostergarProvidencia } from './PostergarProvidencia';

interface PainelProvidenciaProps {
  providencia: Providencia;
  onFechar: () => void;
  /** O aviso de sucesso fica com quem abriu: o painel some junto com a ação. */
  onFeito: (texto: string) => void;
}

const BOTAO =
  'inline-flex min-h-touch w-full items-center justify-center rounded-xl px-4 text-base font-bold disabled:opacity-60';

/** Para onde vão "Marcar na agenda" e "Confirmar tarefa", conforme a origem da pendência. */
function destinos(p: Providencia): { marcar: string; confirmar: string } {
  if (p.origem.tipo === 'etapa') return { marcar: p.origem.lancarHref, confirmar: p.origem.registrarHref };
  const ficha = `/producao/agenda/${p.origem.atribuicaoId}`;
  return { marcar: p.origem.marcarHref, confirmar: ficha };
}

/**
 * RF-66: as três saídas do que pede providência, cada uma na sua tela. Postergar
 * fica no histórico do lote; marcar abre o lançamento (ou a alteração, se a
 * tarefa já existe, trazendo-a para a semana de lançar); confirmar registra a
 * tarefa como feita fora da agenda.
 */
export function PainelProvidencia({ providencia: p, onFechar, onFeito }: PainelProvidenciaProps) {
  const [postergando, setPostergando] = useState(false);
  const para = destinos(p);

  return (
    <Modal titulo={postergando ? `Postergar · ${p.titulo}` : p.titulo} onFechar={onFechar}>
      {p.detalhe && <p className="-mt-2 text-sm text-muted">{p.detalhe}</p>}

      {postergando ? (
        <PostergarProvidencia providencia={p} onVoltar={() => setPostergando(false)} onFeito={onFeito} />
      ) : (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setPostergando(true)} className={`${BOTAO} border-2 border-brand text-brand active:bg-brand-light`}>
            Postergar
          </button>
          <Link href={para.marcar} onClick={onFechar} className={`${BOTAO} border-2 border-brand text-brand active:bg-brand-light`}>
            Marcar na agenda
          </Link>
          <Link href={para.confirmar} onClick={onFechar} className={`${BOTAO} bg-brand text-white active:bg-brand-dark`}>
            Confirmar tarefa
          </Link>
        </div>
      )}
    </Modal>
  );
}
