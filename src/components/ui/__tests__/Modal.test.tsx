import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from '../Modal';

function montar() {
  const onFechar = vi.fn();
  const pai = vi.fn();
  const { container } = render(
    <div onClick={pai}>
      <Modal titulo="Nova espécie" onFechar={onFechar}>
        <input aria-label="Nome" />
      </Modal>
    </div>,
  );
  return { onFechar, pai, fundo: container.querySelector('.fixed') as HTMLElement };
}

describe('Modal', () => {
  it('clicar fora não fecha (F4 §5)', () => {
    const { onFechar, fundo } = montar();
    fireEvent.click(fundo);
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('o × e o Escape fecham', () => {
    const { onFechar } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(2);
  });

  it('o clique de dentro não vaza para quem montou a janela', () => {
    const { pai } = montar();
    fireEvent.click(screen.getByLabelText('Nome'));
    expect(pai).not.toHaveBeenCalled();
  });
});
