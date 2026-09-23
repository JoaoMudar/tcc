'use client';

import { useEffect } from 'react';
import { PessoaForm } from '@/app/(sistema)/cadastros/pessoas/PessoaForm';
import type { PessoaRef } from '@/lib/pessoas-form';

interface ClienteNovoTelaProps {
  verFiscal: boolean;
  onCriado: (cliente: PessoaRef) => void;
  onFechar: () => void;
}

/**
 * UC-31 FA-1: o cadastro de cliente inteiro, em tela cheia por cima do pedido.
 * Só nome e telefone são exigidos; o resto pode ficar em branco. O pedido
 * continua montado embaixo, então voltar dele não perde o que já foi digitado.
 */
export function ClienteNovoTela({ verFiscal, onCriado, onFechar }: ClienteNovoTelaProps) {
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cliente-novo-titulo" className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <h2 id="cliente-novo-titulo" className="text-xl font-bold text-ink">
          Cliente novo
        </h2>
        <p className="text-sm text-muted">Só nome e telefone são obrigatórios. O resto pode ser completado depois.</p>
        <PessoaForm verFiscal={verFiscal} podeEditar paraPedido={{ onCriado, onCancelar: onFechar }} />
      </div>
    </div>
  );
}
