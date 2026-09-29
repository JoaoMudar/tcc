import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atualizar, enfileirar, limpar, listar } from '@/lib/fila-local';
import { BotaoSair } from '../BotaoSair';
import { IndicadorFila } from '../IndicadorFila';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const CHAVE = '00000000-0000-4000-8000-000000000001';

function online(valor: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => valor });
}

async function guardarPerda() {
  await enfileirar({ chave: CHAVE, tipo: 'perda', campos: { quantidade: '30' }, rotulo: 'Perda de 30 no lote 2026-0012' });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await limpar();
  online(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  online(true);
});

describe('IndicadorFila (T9.4)', () => {
  it('com rede e fila vazia, não aparece', async () => {
    online(true);
    render(<IndicadorFila />);
    await act(async () => undefined);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('sem rede, diz quantos esperam, e a lista mostra o que é cada um', async () => {
    await guardarPerda();
    render(<IndicadorFila />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sem conexão · 1 a enviar' }));
    expect(screen.getByText('Perda de 30 no lote 2026-0012')).toBeInTheDocument();
    expect(screen.getByText('Vai sozinho quando a rede voltar.')).toBeInTheDocument();
  });

  it('TA-23: ao voltar a rede, envia sozinho, some e atualiza a tela', async () => {
    await guardarPerda();
    const buscar = vi.fn(async () => new Response(JSON.stringify({ success: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', buscar);
    render(<IndicadorFila />);
    await screen.findByRole('button', { name: 'Sem conexão · 1 a enviar' });

    online(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await vi.waitFor(() => expect(screen.queryByRole('button')).toBeNull());
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalled();
    expect(await listar()).toEqual([]);
  });

  it('o recusado aparece com o motivo, e descartar pede dois toques', async () => {
    await guardarPerda();
    await atualizar(CHAVE, { situacao: 'recusado', mensagem: 'O lote 2026-0012 está encerrado.' });
    render(<IndicadorFila />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sem conexão · 1 recusado' }));
    expect(screen.getByText('O lote 2026-0012 está encerrado.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(await listar()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Sim, descartar' }));
    await vi.waitFor(async () => expect(await listar()).toEqual([]));
  });
});

describe('BotaoSair (E4 A-08)', () => {
  it('com registro esperando rede, avisa quantos são antes de sair', async () => {
    await guardarPerda();
    const logout = vi.fn(async () => undefined);
    render(<BotaoSair logoutAction={logout} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByText(/1 registro ainda não foi enviado/)).toBeInTheDocument();
    expect(await listar()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Ficar e esperar a rede' }));
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('sair mesmo assim apaga a fila do aparelho', async () => {
    await guardarPerda();
    render(<BotaoSair logoutAction={vi.fn(async () => undefined)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sair mesmo assim' }));
    await vi.waitFor(async () => expect(await listar()).toEqual([]));
  });
});
