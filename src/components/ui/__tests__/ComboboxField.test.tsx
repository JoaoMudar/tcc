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
function Campo({
  inicial = '',
  aoMudar,
  required = false,
}: {
  inicial?: string;
  aoMudar?: (valor: string) => void;
  required?: boolean;
}) {
  const [value, setValue] = useState(inicial);
  return (
    <ComboboxField
      label="Espécie"
      name="item_especie"
      options={ESPECIES}
      value={value}
      required={required}
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

  it('não escreve "Escolhido" embaixo do campo depois da escolha', () => {
    render(<Campo />);
    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'ipe' } });
    fireEvent.click(screen.getByText('Ipê-roxo'));
    expect(screen.queryByText(/Escolhido/)).toBeNull();
  });

  it('obrigatório e vazio, o campo visível barra o envio', () => {
    render(<Campo required />);
    const campo = screen.getByLabelText('Espécie') as HTMLInputElement;
    expect(campo).toBeRequired();
    expect(campo.validity.valid).toBe(false);
  });

  it('obrigatório, o texto digitado sem tocar na lista também barra o envio', () => {
    render(<Campo required />);
    const campo = screen.getByLabelText('Espécie') as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'ipe' } });
    expect(campo.validity.customError).toBe(true);

    fireEvent.click(screen.getByText('Ipê-roxo'));
    expect(campo.validity.valid).toBe(true);
  });

  it('mostra o detalhe miúdo na lista e embaixo da escolha', () => {
    const opcoes = [{ value: 'p', label: 'Pitanga', detalhe: 'Eugenia uniflora' }];
    function ComDetalhe() {
      const [value, setValue] = useState('');
      return <ComboboxField label="Espécie" options={opcoes} value={value} onChange={setValue} />;
    }
    render(<ComDetalhe />);
    fireEvent.focus(screen.getByLabelText('Espécie'));
    expect(screen.getByText('Eugenia uniflora')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pitanga'));
    expect(screen.getByText('Eugenia uniflora')).toBeInTheDocument();
    // Digitar por cima desfaz a escolha, e o científico sai junto
    fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'x' } });
    expect(screen.queryByText('Eugenia uniflora')).toBeNull();
  });

  describe('cadastro a partir do texto digitado', () => {
    function comCriar(onCriarNova?: (texto: string) => void) {
      render(
        <ComboboxField
          label="Espécie"
          options={ESPECIES}
          value=""
          onChange={vi.fn()}
          onCriarNova={onCriarNova}
          rotuloCriar={(texto) => `+ Cadastrar "${texto}" como espécie nova`}
        />,
      );
    }

    it('o nome que não está na lista vira botão de cadastrar, que entrega o texto', () => {
      const onCriarNova = vi.fn();
      comCriar(onCriarNova);
      fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: ' Guapuruvu ' } });
      expect(screen.getByText('Nada encontrado com esse texto.')).toBeInTheDocument();
      fireEvent.click(screen.getByText('+ Cadastrar "Guapuruvu" como espécie nova'));
      expect(onCriarNova).toHaveBeenCalledWith('Guapuruvu');
    });

    it('aparece também quando o texto acha nomes parecidos', () => {
      comCriar(vi.fn());
      fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'ipe' } });
      expect(screen.getByText('Ipê-amarelo')).toBeInTheDocument();
      expect(screen.getByText('+ Cadastrar "ipe" como espécie nova')).toBeInTheDocument();
    });

    it('o nome igual ao de uma opção não oferece cadastro, nem sem acento', () => {
      comCriar(vi.fn());
      fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'araca' } });
      expect(screen.queryByText(/Cadastrar/)).toBeNull();
    });

    it('sem a prop, o campo não oferece cadastro', () => {
      comCriar(undefined);
      fireEvent.change(screen.getByLabelText('Espécie'), { target: { value: 'Guapuruvu' } });
      expect(screen.queryByText(/Cadastrar/)).toBeNull();
    });
  });
});
