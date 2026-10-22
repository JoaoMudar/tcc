import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/push-navegador', () => ({
  estadoDoAviso: vi.fn(),
  inscrever: vi.fn(),
  desinscrever: vi.fn(),
  registroDoApp: vi.fn(async () => null),
}));

const navegador = await import('@/lib/push-navegador');
const { AvisosNoCelular } = await import('../AvisosNoCelular');

function montar(aparencia: 'cartao' | 'convite' = 'cartao', chave: string | null = 'chave') {
  const inscreverAction = vi.fn(async () => ({ ok: true }));
  const desinscreverAction = vi.fn(async () => undefined);
  render(
    <AvisosNoCelular
      aparencia={aparencia}
      chavePublica={chave}
      inscreverAction={inscreverAction}
      desinscreverAction={desinscreverAction}
    />,
  );
  return { inscreverAction, desinscreverAction };
}

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('AvisosNoCelular', () => {
  it('liga o aviso e manda a inscrição ao servidor', async () => {
    vi.mocked(navegador.estadoDoAviso).mockResolvedValue('desligado');
    vi.mocked(navegador.inscrever).mockResolvedValue({ endpoint: 'https://e', keys: { p256dh: 'p', auth: 'a' } });
    const { inscreverAction } = montar();
    const botao = await screen.findByRole('button', { name: /ligar avisos/i });
    await act(async () => fireEvent.click(botao));
    expect(inscreverAction).toHaveBeenCalledWith({ endpoint: 'https://e', keys: { p256dh: 'p', auth: 'a' } });
    expect(await screen.findByText(/avisos ligados/i)).toBeInTheDocument();
  });

  it('recusado pela pessoa, explica como liberar', async () => {
    vi.mocked(navegador.estadoDoAviso).mockResolvedValue('desligado');
    vi.mocked(navegador.inscrever).mockResolvedValue('negado');
    montar();
    const botao = await screen.findByRole('button', { name: /ligar avisos/i });
    await act(async () => fireEvent.click(botao));
    expect(await screen.findByText(/foram bloqueados/i)).toBeInTheDocument();
  });

  it('desliga e apaga a inscrição do servidor', async () => {
    vi.mocked(navegador.estadoDoAviso).mockResolvedValue('ligado');
    vi.mocked(navegador.desinscrever).mockResolvedValue('https://e');
    const { desinscreverAction } = montar();
    const botao = await screen.findByRole('button', { name: /desligar avisos/i });
    await act(async () => fireEvent.click(botao));
    expect(desinscreverAction).toHaveBeenCalledWith('https://e');
  });

  it('o convite some depois de dispensado, e não volta', async () => {
    vi.mocked(navegador.estadoDoAviso).mockResolvedValue('desligado');
    montar('convite');
    const botao = await screen.findByRole('button', { name: /agora não/i });
    await act(async () => fireEvent.click(botao));
    expect(screen.queryByRole('button', { name: /ligar avisos/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('avisos-convite-dispensado')).toBe('1');
  });

  it('o convite não aparece com o aviso já ligado', async () => {
    vi.mocked(navegador.estadoDoAviso).mockResolvedValue('ligado');
    montar('convite');
    await waitFor(() => expect(navegador.estadoDoAviso).toHaveBeenCalled());
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sem chave no servidor, o convite não aparece', () => {
    vi.mocked(navegador.estadoDoAviso).mockResolvedValue('desligado');
    montar('convite', null);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
