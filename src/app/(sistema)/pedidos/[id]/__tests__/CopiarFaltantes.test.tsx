import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopiarFaltantes, TEMPO_COPIADO_MS } from '../CopiarFaltantes';

const writeText = vi.fn<(texto: string) => Promise<void>>(async () => undefined);

beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => vi.useRealTimers());

describe('copiar faltantes', () => {
  it('copia uma linha por item e confirma no próprio botão', async () => {
    vi.useFakeTimers();
    render(<CopiarFaltantes linhas={['10 - Ipê - 1,20 m', '4 - Araçá']} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar faltantes' }));
    });
    expect(writeText).toHaveBeenCalledWith('10 - Ipê - 1,20 m\n4 - Araçá');
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(TEMPO_COPIADO_MS));
    expect(screen.getByRole('button', { name: 'Copiar faltantes' })).toBeTruthy();
  });

  it('avisa quando o navegador não deixa copiar', async () => {
    writeText.mockRejectedValueOnce(new Error('negado'));
    render(<CopiarFaltantes linhas={['10 - Ipê']} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar faltantes' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível copiar');
  });
});
