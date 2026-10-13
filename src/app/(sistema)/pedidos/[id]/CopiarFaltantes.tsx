'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';

/** Quanto o "Copiado" fica no botão antes de ele voltar ao rótulo. */
export const TEMPO_COPIADO_MS = 2000;

/**
 * "Copiar faltantes": a lista do que a verificação não achou vai para a área
 * de transferência, uma linha por item, pronta para colar no WhatsApp.
 */
export function CopiarFaltantes({ linhas }: { linhas: readonly string[] }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const timer = setTimeout(() => setCopiado(false), TEMPO_COPIADO_MS);
    return () => clearTimeout(timer);
  }, [copiado]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(linhas.join('\n'));
      setErro(false);
      setCopiado(true);
    } catch {
      setErro(true);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={copiar}>
        {copiado ? 'Copiado' : 'Copiar faltantes'}
      </Button>
      {erro && <Notice tone="error">Não foi possível copiar. Tente de novo.</Notice>}
    </div>
  );
}
