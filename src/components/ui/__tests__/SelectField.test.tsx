import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectField, agruparOpcoes } from '../SelectField';

const CAUSAS = [
  { value: 'seca', label: 'Seca' },
  { value: 'praga', label: 'Praga' },
  { value: 'geada', label: 'Geada' },
];

describe('SelectField', () => {
  it('oferece só as opções da lista, começando sem escolha', () => {
    render(<SelectField label="Causa" name="causa" options={CAUSAS} />);
    const select = screen.getByLabelText('Causa') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Escolha…', 'Seca', 'Praga', 'Geada']);
  });

  it('aceita ser controlado sem virar controlado e não-controlado ao mesmo tempo', () => {
    const erros = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SelectField label="Causa" name="causa" options={CAUSAS} value="praga" onChange={() => {}} />);
    const select = screen.getByLabelText('Causa') as HTMLSelectElement;
    expect(select.value).toBe('praga');
    expect(erros).not.toHaveBeenCalled();
    erros.mockRestore();
  });

  it('associa o erro', () => {
    render(<SelectField label="Causa" name="causa" options={CAUSAS} error="Escolha a causa." />);
    expect(screen.getByLabelText('Causa')).toHaveAccessibleDescription('Escolha a causa.');
  });

  it('o obrigatório leva o asterisco no rótulo, o opcional não', () => {
    render(<SelectField label="Causa" name="causa" options={CAUSAS} required />);
    render(<SelectField label="Canal" name="canal" options={CAUSAS} />);
    expect(screen.getByText('Causa').className).toContain("after:content-['*']");
    expect(screen.getByText('Canal').className).not.toContain('after:content');
  });

  it('opções com grupo saem debaixo do título; a sem grupo fica solta', () => {
    const opcoes = [
      { value: 'x', label: 'Ainda não sei' },
      { value: 'a', label: 'Seca', grupo: 'Clima' },
      { value: 'b', label: 'Geada', grupo: 'Clima' },
      { value: 'c', label: 'Praga', grupo: 'Bicho' },
    ];
    render(<SelectField label="Causa" name="causa" options={opcoes} />);
    const select = screen.getByLabelText('Causa');
    const grupos = [...select.querySelectorAll('optgroup')];
    expect(grupos.map((g) => g.label)).toEqual(['Clima', 'Bicho']);
    expect([...grupos[0].querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Seca', 'Geada']);
    expect(select.querySelector('option[value="x"]')?.parentElement).toBe(select);
  });

  it('sem grupo nenhum, a lista não ganha optgroup', () => {
    render(<SelectField label="Causa" name="causa" options={CAUSAS} />);
    expect(screen.getByLabelText('Causa').querySelector('optgroup')).toBeNull();
  });

  it('agruparOpcoes junta só as opções seguidas do mesmo grupo', () => {
    const blocos = agruparOpcoes([
      { value: '1', label: '1', grupo: 'A' },
      { value: '2', label: '2', grupo: 'A' },
      { value: '3', label: '3', grupo: 'B' },
    ]);
    expect(blocos.map((b) => [b.grupo, b.opcoes.length])).toEqual([
      ['A', 2],
      ['B', 1],
    ]);
  });
});
