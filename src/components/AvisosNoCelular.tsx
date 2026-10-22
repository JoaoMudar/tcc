'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { type EstadoAviso, desinscrever, estadoDoAviso, inscrever, registroDoApp } from '@/lib/push-navegador';

interface AvisosNoCelularProps {
  chavePublica: string | null;
  inscreverAction: (inscricao: unknown) => Promise<{ ok: boolean }>;
  desinscreverAction: (endpoint: string) => Promise<void>;
  /** `cartao` é o controle completo de Aparelhos conectados; `convite` só aparece enquanto o aviso está desligado. */
  aparencia?: 'cartao' | 'convite';
}

const DISPENSADO = 'avisos-convite-dispensado';

function lerDispensado(): boolean {
  try {
    return localStorage.getItem(DISPENSADO) === '1';
  } catch {
    return false;
  }
}

/**
 * Liga e desliga o aviso do pedido neste aparelho. Ao abrir com o aviso já
 * ligado, reenvia a inscrição: se outra pessoa entrou no mesmo celular, os
 * avisos passam a ser os dela.
 */
export function AvisosNoCelular({ chavePublica, inscreverAction, desinscreverAction, aparencia = 'cartao' }: AvisosNoCelularProps) {
  const [estado, setEstado] = useState<EstadoAviso>('carregando');
  const [ocupado, setOcupado] = useState(false);
  const [dispensado, setDispensado] = useState(true);

  useEffect(() => {
    let vivo = true;
    estadoDoAviso()
      .then(async (atual) => {
        if (vivo) {
          setDispensado(lerDispensado());
          setEstado(atual);
        }
        if (atual !== 'ligado') return;
        const inscricao = await (await registroDoApp())?.pushManager.getSubscription();
        if (inscricao) await inscreverAction(inscricao.toJSON());
      })
      .catch(() => vivo && setEstado('sem-suporte'));
    return () => {
      vivo = false;
    };
  }, [inscreverAction]);

  if (!chavePublica) return aparencia === 'cartao' ? <Cartao>Os avisos ainda não foram configurados no servidor.</Cartao> : null;

  async function ligar() {
    if (!chavePublica) return;
    setOcupado(true);
    try {
      const resultado = await inscrever(chavePublica);
      if (resultado === 'negado') setEstado('negado');
      else if (resultado && (await inscreverAction(resultado)).ok) setEstado('ligado');
    } catch {
      setEstado(await estadoDoAviso().catch(() => 'sem-suporte' as const));
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    try {
      const endpoint = await desinscrever();
      if (endpoint) await desinscreverAction(endpoint);
      setEstado('desligado');
    } finally {
      setOcupado(false);
    }
  }

  function dispensar() {
    setDispensado(true);
    try {
      localStorage.setItem(DISPENSADO, '1');
    } catch {
      // Sem armazenamento, o convite volta na próxima visita
    }
  }

  if (aparencia === 'convite') {
    if (estado !== 'desligado' || dispensado) return null;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-brand-muted bg-green-50 p-4">
        <p className="text-base text-ink">
          <span aria-hidden="true">🔔 </span>
          Quer saber na hora quando um pedido chegar para você? Ligue os avisos neste celular.
        </p>
        <div className="flex gap-2">
          <Button onClick={ligar} pending={ocupado} pendingLabel="Ligando…">
            Ligar avisos
          </Button>
          <Button variant="secondary" onClick={dispensar} className="w-auto">
            Agora não
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Cartao>
      {estado === 'carregando' && 'Conferindo este aparelho…'}
      {estado === 'sem-suporte' && 'Este navegador não recebe avisos. Abra o sistema pelo app instalado no celular.'}
      {estado === 'instalar' &&
        'No iPhone, os avisos só chegam com o app na tela de início: toque em Compartilhar, depois em "Adicionar à Tela de Início", e abra por lá.'}
      {estado === 'negado' &&
        'Os avisos foram bloqueados neste aparelho. Para liberar, abra as configurações do navegador, procure Notificações e permita este site.'}
      {estado === 'desligado' && (
        <>
          <span>Receba um aviso quando um pedido passar para você.</span>
          <Button onClick={ligar} pending={ocupado} pendingLabel="Ligando…">
            Ligar avisos neste aparelho
          </Button>
        </>
      )}
      {estado === 'ligado' && (
        <>
          <span>
            <span aria-hidden="true">🔔 </span>Avisos ligados neste aparelho.
          </span>
          <Button variant="secondary" onClick={desligar} pending={ocupado} pendingLabel="Desligando…">
            Desligar avisos
          </Button>
        </>
      )}
    </Cartao>
  );
}

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 text-base text-gray-700">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Avisos no celular</h2>
      {children}
    </div>
  );
}
