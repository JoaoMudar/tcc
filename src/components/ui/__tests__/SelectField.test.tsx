import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('associa o erro', () => {
    render(<SelectField label="Causa" name="causa" options={CAUSAS} error="Escolha a causa." />);
    expect(screen.getByLabelText('Causa')).toHaveAccessibleDescription('Escolha a causa.');
  });
});
