'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime } from '@/lib/format';
import { esvaziarFila } from '@/lib/fila-envio';
import { EVENTO_FILA, type RegistroPendente, listar, remover } from '@/lib/fila-local';

const INTERVALO_MS = 30_000;

function assinarRede(avisar: () => void) {
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  return () => {
    window.removeEventListener('online', avisar);
    window.removeEventListener('offline', avisar);
  };
}

/**
 * O que está guardado no aparelho e ainda não chegou (T9.4, RNF-05). Some
 * quando a fila está vazia e há rede. Tenta enviar ao abrir, ao voltar a rede,
 * ao voltar para a aba e a cada 30 segundos enquanto houver pendente.
 *
 * O recusado não é reenviado: o servidor disse por que não, e só a pessoa sabe
 * se refaz o registro ou desiste. Descartar pede dois toques.
 */
export function IndicadorFila() {
  const router = useRouter();
  const [registros, setRegistros] = useState<RegistroPendente[]>([]);
  // No servidor não há rede para ler: a página nasce "com rede" e corrige no aparelho
  const semRede = useSyncExternalStore(assinarRede, () => !navigator.onLine, () => false);
  const [aberto, setAberto] = useState(false);
  const [descartando, setDescartando] = useState<string | null>(null);

  const tentar = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const { enviados } = await esvaziarFila();
      // A ficha aberta passa a mostrar o saldo com o que acabou de chegar
      if (enviados > 0) router.refresh();
    } catch {
      // Fila indisponível neste navegador: não há o que enviar
    }
  }, [router]);

  useEffect(() => {
    let montado = true;
    const ler = () =>
      listar().then(
        (lista) => montado && setRegistros(lista),
        () => montado && setRegistros([]),
      );
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void tentar();
    };
    const aoVoltarRede = () => void tentar();
    ler();
    void tentar();

    window.addEventListener(EVENTO_FILA, ler);
    window.addEventListener('online', aoVoltarRede);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      montado = false;
      window.removeEventListener(EVENTO_FILA, ler);
      window.removeEventListener('online', aoVoltarRede);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [tentar]);

  const pendentes = registros.filter((r) => r.situacao === 'pendente');
  const recusados = registros.filter((r) => r.situacao === 'recusado');

  useEffect(() => {
    if (pendentes.length === 0) return;
    const relogio = window.setInterval(() => void tentar(), INTERVALO_MS);
    return () => window.clearInterval(relogio);
  }, [pendentes.length, tentar]);

  if (!semRede && registros.length === 0) return null;

  const partes = [
    semRede && 'Sem conexão',
    pendentes.length > 0 && `${pendentes.length} a enviar`,
    recusados.length > 0 && `${recusados.length} ${recusados.length === 1 ? 'recusado' : 'recusados'}`,
  ].filter(Boolean);
  const cor = recusados.length > 0 ? 'bg-red-700' : semRede || pendentes.length > 0 ? 'bg-amber-700' : 'bg-brand-dark';

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-live="polite"
        className={`fixed right-3 bottom-16 z-20 min-h-touch rounded-full px-4 text-sm font-bold text-white shadow-lg md:top-3 md:bottom-auto ${cor}`}
      >
        {partes.join(' · ')}
      </button>

      {aberto && (
        <Modal titulo="Guardado no aparelho" onFechar={() => setAberto(false)}>
          <div className="flex flex-col gap-3">
            {registros.length === 0 && <p className="text-base text-muted">Nada esperando envio.</p>}
            {pendentes.length > 0 && (
              <p className="text-base text-muted">
                {semRede ? 'Vai sozinho quando a rede voltar.' : 'Enviando assim que o sistema responder.'}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {registros.map((r) => (
                <li
                  key={r.chave}
                  className={`rounded-xl border px-3 py-2 ${r.situacao === 'recusado' ? 'border-red-200 bg-red-50' : 'border-line'}`}
                >
                  <p className="text-base font-semibold text-ink">{r.rotulo}</p>
                  <p className="text-sm text-muted">{formatDateTime(new Date(r.criadoEm))}</p>
                  {r.mensagem && (
                    <p className={`mt-1 text-sm ${r.situacao === 'recusado' ? 'text-red-800' : 'text-ink'}`}>{r.mensagem}</p>
                  )}
                  {r.situacao === 'recusado' &&
                    (descartando === r.chave ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <p className="text-sm text-ink">Descartar apaga o registro do aparelho. Não volta.</p>
                        <Button variant="primary" onClick={() => setDescartando(null)}>
                          Não, manter
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            await remover(r.chave).catch(() => undefined);
                            setDescartando(null);
                          }}
                        >
                          Sim, descartar
                        </Button>
                      </div>
                    ) : (
                      <Button variant="secondary" className="mt-2" onClick={() => setDescartando(r.chave)}>
                        Descartar
                      </Button>
                    ))}
                </li>
              ))}
            </ul>
            {pendentes.length > 0 && !semRede && (
              <Button variant="outline" onClick={() => void tentar()}>
                Enviar agora
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
