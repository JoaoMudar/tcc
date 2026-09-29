import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CampoEndereco } from '../CampoEndereco';

const POSTO = { rotulo: 'Posto Ipiranga, Rio do Sul, SC', lat: -27.2, lng: -49.6 };

function montar(buscar = vi.fn(async () => [POSTO])) {
  const { container } = render(
    <form>
      <CampoEndereco label="Endereço" name="endereco" buscar={buscar} />
    </form>,
  );
  const escondido = (nome: string) => container.querySelector<HTMLInputElement>(`input[name="${nome}"]`)!;
  return { buscar, campo: screen.getByLabelText('Endereço'), escondido };
}

describe('CampoEndereco', () => {
  it('sugere enquanto se digita, e a escolha preenche o texto e a coordenada', async () => {
    const { buscar, campo, escondido } = montar();
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: 'posto rio' } });

    fireEvent.click(await screen.findByRole('button', { name: POSTO.rotulo }));
    expect(buscar).toHaveBeenCalledWith('posto rio');
    expect(escondido('endereco').value).toBe(POSTO.rotulo);
    expect(escondido('lat').value).toBe('-27.2');
    expect(escondido('lng').value).toBe('-49.6');
  });

  it('digitar depois da escolha desfaz a coordenada, e o texto livre continua valendo', async () => {
    const { campo, escondido } = montar();
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: 'posto rio' } });
    fireEvent.click(await screen.findByRole('button', { name: POSTO.rotulo }));

    fireEvent.change(campo, { target: { value: 'Rua Tal, 10' } });
    expect(escondido('endereco').value).toBe('Rua Tal, 10');
    expect(escondido('lat').value).toBe('');
  });

  it('texto curto não consulta', async () => {
    const { buscar, campo } = montar();
    fireEvent.change(campo, { target: { value: 'po' } });
    await new Promise((resolver) => setTimeout(resolver, 400));
    expect(buscar).not.toHaveBeenCalled();
  });
});
