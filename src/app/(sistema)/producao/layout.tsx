import type { ReactNode } from 'react';

/**
 * As telas de tarefa abertas da agenda vêm no slot `modal`, por cima dela
 * (rota interceptada); pelo endereço, a mesma tela é página inteira.
 */
export default function ProducaoLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
