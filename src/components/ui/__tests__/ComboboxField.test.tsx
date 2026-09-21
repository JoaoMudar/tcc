import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ComboboxField } from '../ComboboxField';

const ESPECIES = [
  { value: 'a', label: 'Ipê-amarelo' },
  { value: 'b', label: 'Ipê-roxo' },
  { value: 'c', label: 'Araçá' },
];

/** O componente é controlado: quem testa precisa segurar o valor, como a tela faz. */
function Campo({ inicial = '', aoMudar }: { inicial?: string; aoMudar?: (valor: string) => void }) {
  const [value, setValue] = useState(inicial);
  return (
    <ComboboxField
      label="Espécie"
      name="item_especie"
      options={ESPECIES}
      value={value}
      onChange={(valor) => {
        setValue(valor);
        aoMudar?.(valor);
      }}
    />
  );
}

const escondido = () => document.querySelector('input[name="item_especie"]') as HTMLInputElement;

describe('ComboboxField', () => {
  it('filtra enquanto se digita e escolhe pelo toque na lista', () => {
    const aoMudar = vi.fn();
    render(<Campo aoMudar={aoMudar} />);
    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'ipe' } });

    expect(screen.getByText('Ipê-amarelo')).toBeInTheDocument();
    expect(screen.queryByText('Araçá')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Ipê-roxo'));
    expect(aoMudar).toHaveBeenCalledWith('b');
    expect(escondido().value).toBe('b');
    expect((screen.getByLabelText('Espécie') as HTMLInputElement).value).toBe('Ipê-roxo');
  });

  it('o formulário recebe o id da lista, e nunca o texto digitado', () => {
    render(<Campo />);
    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'Ipê-amarelo' } });
    expect(escondido().value).toBe('');
  });

  it('digitar depois de escolher desfaz a escolha, para não enviar o par errado', () => {
    render(<Campo inicial="a" />);
    expect(escondido().value).toBe('a');
    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'Ipê-am' } });
    expect(escondido().value).toBe('');
  });

  it('avisa quem digitou e não tocou na lista', () => {
    render(<Campo />);
    const campo = screen.getByLabelText('Espécie');
    fireEvent.change(campo, { target: { value: 'ipe' } });
    fireEvent.blur(campo);
    expect(screen.getByText('Toque num nome da lista para escolher.')).toBeInTheDocument();
  });

  it('diz que não achou em vez de mostrar lista vazia', () => {
    render(<Campo />);
    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'eucalipto' } });
    expect(screen.getByText('Nada encontrado com esse texto.')).toBeInTheDocument();
  });

  it('abre com a escolha já feita escrita no campo', () => {
    render(<Campo inicial="c" />);
    expect((screen.getByLabelText('Espécie') as HTMLInputElement).value).toBe('Araçá');
  });

  it('associa o erro ao campo', () => {
    render(
      <ComboboxField label="Cliente" name="cliente_id" options={ESPECIES} value="" onChange={() => {}} error="Escolha o cliente." />,
    );
    expect(screen.getByLabelText('Cliente')).toHaveAccessibleDescription('Escolha o cliente.');
  });
});
