'use client';

import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';

interface ConfirmacaoDuplaProps {
  /** O que o botão da tela diz, antes de qualquer coisa acontecer. */
  rotuloBotao: string;
  titulo: string;
  /** O que a ação faz de irreversível, em uma frase. */
  aviso: string;
  rotuloConfirmar: string;
  rotuloVoltar?: string;
  action: (payload: FormData) => void;
  pendente?: boolean;
  /**
   * O erro da action entra **dentro** da folha: a folha cobre a tela, e um aviso
   * atrás dela é um aviso que ninguém lê.
   */
  erro?: string;
  /** Campos ocultos e o que mais o formulário precisar enviar. */
  children?: ReactNode;
}

/**
 * Ação que não volta atrás pede dois toques, e o segundo é dado depois de ler o
 * que vai acontecer. O primeiro toque **não envia nada**: só abre a folha.
 *
 * O botão seguro é o primário, e o que confirma é o apagado. Quem está com o
 * celular na mão e a cabeça no pedido erra o alvo, e errar o alvo tem de cair no
 * lado que não faz nada.
 */
export function ConfirmacaoDupla({
  rotuloBotao,
  titulo,
  aviso,
  rotuloConfirmar,
  rotuloVoltar = 'Não, voltar',
  action,
  pendente = false,
  erro,
  children,
}: ConfirmacaoDuplaProps) {
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setAberta(true)}>
        {rotuloBotao}
      </Button>

      {aberta && (
        <Modal titulo={titulo} onFechar={() => setAberta(false)}>
          <form action={action} className="flex flex-col gap-3">
            <Notice tone="warning">{aviso}</Notice>
            {children}
            {erro && <Notice tone="error">{erro}</Notice>}
            <Button type="submit" variant="secondary" pending={pendente} pendingLabel="Confirmando…">
              {rotuloConfirmar}
            </Button>
            <Button variant="primary" onClick={() => setAberta(false)}>
              {rotuloVoltar}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
