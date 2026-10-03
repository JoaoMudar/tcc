import { afterEach, describe, expect, it, vi } from 'vitest';
import { removeServiceWorker } from '../RegistraServiceWorker';

function simular(registros: { unregister: () => Promise<boolean> }[], nomes: string[]) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistrations: vi.fn(async () => registros) },
  });
  const apagar = vi.fn(async () => true);
  vi.stubGlobal('caches', { keys: vi.fn(async () => nomes), delete: apagar });
  return apagar;
}

afterEach(() => vi.unstubAllGlobals());

describe('removeServiceWorker (dev)', () => {
  it('tira o service worker que ficou, apaga o cache dele e avisa que precisa recarregar', async () => {
    const registro = { unregister: vi.fn(async () => true) };
    const apagar = simular([registro], ['casca-v1', 'paginas-v1']);
    await expect(removeServiceWorker()).resolves.toBe(true);
    expect(registro.unregister).toHaveBeenCalled();
    expect(apagar).toHaveBeenCalledWith('casca-v1');
    expect(apagar).toHaveBeenCalledWith('paginas-v1');
  });

  it('sem service worker registrado, não mexe no cache nem pede para recarregar', async () => {
    const apagar = simular([], ['casca-v1']);
    await expect(removeServiceWorker()).resolves.toBe(false);
    expect(apagar).not.toHaveBeenCalled();
  });
});
