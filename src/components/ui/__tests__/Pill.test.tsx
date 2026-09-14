import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pill } from '../Pill';

describe('Pill', () => {
  it('mostra o texto com a cor do tom', () => {
    render(<Pill tone="red">Recusado</Pill>);
    expect(screen.getByText('Recusado').className).toContain('bg-red-100');
  });
});
