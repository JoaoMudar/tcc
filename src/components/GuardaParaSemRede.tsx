'use client';

import { useEffect } from 'react';

/**
 * Pede ao service worker que guarde esta ficha inteira (T9.2, TA-59). A ficha
 * aberta por link interno chega como dados do Next, e o service worker só a
 * veria como página se ela fosse aberta pelo endereço; sem isso, recarregar sem
 * rede perderia o formulário de campo.
 */
export function GuardaParaSemRede({ caminho }: { caminho: string }) {
  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage({ guardar: caminho });
  }, [caminho]);
  return null;
}
