'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker (T9.2). Só em produção: em desenvolvimento o cache
 * esconderia a alteração que se acabou de fazer.
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
