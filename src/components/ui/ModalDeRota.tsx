'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback } from 'react';
import { Modal } from './Modal';

interface ModalDeRotaProps {
  titulo: string;
  children: ReactNode;
}

/**
 * A tela aberta por cima de onde a pessoa estava (rota interceptada): fechar é
 * voltar no histórico, e a tela de baixo continua como estava.
 */
export function ModalDeRota({ titulo, children }: ModalDeRotaProps) {
  const router = useRouter();
  const fechar = useCallback(() => router.back(), [router]);
  return (
    <Modal titulo={titulo} posicao="centro" onFechar={fechar}>
      {children}
    </Modal>
  );
}
