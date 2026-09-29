'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { limpar, listar } from '@/lib/fila-local';

interface BotaoSairProps {
  logoutAction: () => Promise<void>;
  /** `menu` é o texto da coluna lateral; `botao` é o botão largo da tela Mais. */
  aparencia?: 'menu' | 'botao';
}

/** Apaga do aparelho a fila e as fichas guardadas (E4 A-08). */
async function limparAparelho() {
  await limpar().catch(() => undefined);
  navigator.serviceWorker?.controller?.postMessage('limpar');
}

/**
 * Sair (RF-03) limpa o aparelho: quem pega o celular depois não encontra o que
 * o anterior digitou nem as fichas que ele abriu (T9.2, E4 A-08). Se ainda há
 * registro esperando rede, sair o perderia, e por isso pede um segundo toque
 * depois de dizer quantos são.
 */
export function BotaoSair({ logoutAction, aparencia = 'botao' }: BotaoSairProps) {
  const formulario = useRef<HTMLFormElement>(null);
  const [naoEnviados, setNaoEnviados] = useState(0);

  async function sair() {
    await limparAparelho();
    formulario.current?.requestSubmit();
  }

  async function aoTocar() {
    const pendentes = (await listar().catch(() => [])).filter((r) => r.situacao === 'pendente').length;
    if (pendentes > 0) setNaoEnviados(pendentes);
    else await sair();
  }

  return (
    <form ref={formulario} action={logoutAction} className={aparencia === 'botao' ? 'mt-4 flex flex-col gap-2' : 'flex flex-col gap-2'}>
      {naoEnviados > 0 ? (
        <>
          <p role="alert" className="text-sm text-red-800">
            {naoEnviados === 1 ? '1 registro ainda não foi enviado' : `${naoEnviados} registros ainda não foram enviados`}. Sair
            apaga do aparelho.
          </p>
          <Button variant="primary" onClick={() => setNaoEnviados(0)}>
            Ficar e esperar a rede
          </Button>
          <Button variant="secondary" onClick={() => void sair()}>
            Sair mesmo assim
          </Button>
        </>
      ) : aparencia === 'botao' ? (
        <Button variant="outline" onClick={() => void aoTocar()}>
          Sair
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => void aoTocar()}
          className="mt-1 min-h-touch w-full rounded-lg text-left text-base font-semibold text-ink"
        >
          Sair
        </button>
      )}
    </form>
  );
}
