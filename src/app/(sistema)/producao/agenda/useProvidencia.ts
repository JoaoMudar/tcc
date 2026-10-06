'use client';

import { useCallback, useState } from 'react';
import type { Providencia } from '@/lib/providencia';
import type { AvisoDesfazer } from './ToastDesfazer';

/** O painel de providência aberto e o aviso que fica quando ele fecha por ter feito algo (RF-66). */
export function useProvidencia() {
  const [aberta, setAberta] = useState<Providencia | null>(null);
  const [aviso, setAviso] = useState<AvisoDesfazer | null>(null);
  const fecharAviso = useCallback(() => setAviso(null), []);
  const fechar = useCallback(() => setAberta(null), []);
  const feito = useCallback((texto: string) => {
    setAberta(null);
    setAviso({ texto, tom: 'info' });
  }, []);
  return { aberta, abrir: setAberta, fechar, feito, aviso, fecharAviso };
}
