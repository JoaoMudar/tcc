import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectField } from '../SelectField';

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
});
