'use client';

import { useEffect } from 'react';

/**
 * Tira o service worker que ficou de um `next start` na mesma origem. No dev os
 * chunks não têm hash de conteúdo, e o cache primeiro dele servia o CSS velho:
 * a agenda abria com as tarefas sem cor. A página já veio do cache, então
 * recarrega uma vez, quando havia o que tirar.
 */
export async function removeServiceWorker(): Promise<boolean> {
  const registros = await navigator.serviceWorker.getRegistrations();
  if (registros.length === 0) return false;
  await Promise.all(registros.map((registro) => registro.unregister()));
  if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map((nome) => caches.delete(nome)));
  return true;
}

/**
 * Registra o service worker (T9.2). Só em produção: em desenvolvimento o cache
 * esconderia a alteração que se acabou de fazer, e o que estiver registrado sai.
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      removeServiceWorker()
        .then((removeu) => {
          if (removeu) window.location.reload();
        })
        .catch(() => undefined);
      return;
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
