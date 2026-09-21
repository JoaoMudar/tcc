import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmacaoDupla } from '../ConfirmacaoDupla';

function montar(props: Partial<Parameters<typeof ConfirmacaoDupla>[0]> = {}) {
  const action = vi.fn();
  render(
    <ConfirmacaoDupla
      rotuloBotao="Cancelar pedido"
      titulo="Cancelar o pedido?"
      aviso="O pedido não volta atrás."
      rotuloConfirmar="Sim, cancelar o pedido"
      action={action}
      {...props}
    />,
  );
  return { action };
}

describe('ConfirmacaoDupla', () => {
  it('o primeiro toque só abre a folha, e não envia nada', () => {
    const { action } = montar();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('O pedido não volta atrás.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sim, cancelar o pedido' })).toBeInTheDocument();
  });

  it('voltar fecha a folha sem fazer nada', () => {
    const { action } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    fireEvent.click(screen.getByRole('button', { name: 'Não, voltar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it('o erro da action aparece dentro da folha, que é onde a pessoa está olhando', () => {
    montar({ erro: 'Pedido não encontrado.' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Pedido não encontrado.');
  });

  it('leva os campos do formulário para dentro da folha', () => {
    montar({
      children: <input type="hidden" name="pedido_id" value="abc" readOnly />,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    expect(screen.getByRole('dialog').querySelector('input[name="pedido_id"]')).toHaveValue('abc');
  });
});
