'use client';

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { COOKIE_ZOOM, type Zoom } from '@/lib/agenda-zoom';

interface ZoomContexto {
  zoom: Zoom;
  setZoom: (zoom: Zoom) => void;
}

/** Fora do provedor (os testes da grade), a grade fica na semana e o zoom não muda. */
const Contexto = createContext<ZoomContexto>({ zoom: 'semana', setZoom: () => undefined });

/**
 * O zoom da agenda, dividido entre o seletor do cabeçalho, as setas e a grade.
 * Fica num cookie, e não no `localStorage`: o servidor o lê, e a página nasce no
 * zoom certo, sem piscar a semana antes.
 */
export function ZoomAgenda({ inicial, children }: { inicial: Zoom; children: ReactNode }) {
  const [zoom, setEstado] = useState(inicial);
  const setZoom = useCallback((novo: Zoom) => {
    setEstado(novo);
    document.cookie = `${COOKIE_ZOOM}=${novo}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  const valor = useMemo(() => ({ zoom, setZoom }), [zoom, setZoom]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useZoomAgenda(): ZoomContexto {
  return useContext(Contexto);
}
