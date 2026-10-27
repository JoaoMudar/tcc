'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { diaUtilAnterior, formatData } from '@/lib/datas';
import { formatDateTime } from '@/lib/format';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import {
  CANAIS_VENDA,
  type CanalVenda,
  DONO_SITUACAO,
  ROTULO_URGENCIA,
  SITUACOES_PEDIDO,
  type SituacaoPedido,
  filtraPedidosPorCliente,
  formatTotal,
  urgenciaPedido,
} from '@/lib/pedidos-rotulos';
import { PERFIL_LABELS } from '@/lib/perfis';

export interface PedidoDaLista {
  id: string;
  numero: number;
  clienteId: string;
  cliente: string;
  canal: CanalVenda;
  situacao: SituacaoPedido;
  criadoEm: Date;
  dataEntrega: string | null;
  itens: number;
  totalCentavos: number | null;
}

interface ListaPedidosProps {
  pedidos: readonly PedidoDaLista[];
  hoje: string;
  /** O filtro que veio no endereço (`?cliente=` ou `?q=`), aplicado também no banco. */
  filtroInicial?: { clienteId: string; texto: string };
}

/** Quanto esperar depois da última tecla antes de pedir ao servidor. */
export const ATRASO_FILTRO_MS = 400;

const TOM: Record<SituacaoPedido, PillTone> = {
  cadastrado: 'neutral',
  verificando: 'blue',
  verificado: 'blue',
  pendente_alteracao: 'amber',
  aprovado: 'green',
  separando: 'blue',
  pronto_envio: 'green',
  cancelado: 'red',
};

/** T8.15: o que o pedido está esperando de quem, para a lista dizer a providência. */
const PROVIDENCIA: Partial<Record<SituacaoPedido, string>> = {
  aprovado: 'ORGANIZAR CARGAS',
  separando: 'SEPARANDO',
};

/**
 * RF-60: a carteira, filtrada pelo cliente enquanto se digita. O campo é o
 * mesmo do novo pedido, e a lista dele só traz quem tem pedido aqui: escolher
 * um cliente sem pedido seria escolher uma tela vazia.
 */
export function ListaPedidos({ pedidos, hoje, filtroInicial = { clienteId: '', texto: '' } }: ListaPedidosProps) {
  const [clienteId, setClienteId] = useState(filtroInicial.clienteId);
  const [texto, setTexto] = useState(filtroInicial.texto);

  // RF-60: a lista filtra na hora, e o endereço leva o filtro ao banco depois de
  // uma pausa na digitação, que é o que acha o pedido antigo fora dos 300 mais novos
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const espera = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('cliente');
      params.delete('q');
      if (clienteId) params.set('cliente', clienteId);
      else if (texto.trim()) params.set('q', texto.trim());
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, ATRASO_FILTRO_MS);
    return () => clearTimeout(espera);
  }, [clienteId, texto, pathname, router, searchParams]);

  const clientes = useMemo(() => {
    const porId = new Map(pedidos.map((pedido) => [pedido.clienteId, pedido.cliente]));
    return [...porId]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [pedidos]);

  const visiveis = filtraPedidosPorCliente(pedidos, { clienteId, texto });

  return (
    <div className="flex flex-col gap-3">
      <ComboboxField
        label="Cliente"
        options={clientes}
        value={clienteId}
        onChange={setClienteId}
        onDigitar={setTexto}
        placeholder="Digite o nome do cliente"
      />

      {visiveis.length === 0 ? (
        <p className="text-base text-muted">
          {pedidos.length === 0 ? 'Nenhum pedido registrado.' : 'Nenhum pedido desse cliente.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
          {visiveis.map((pedido) => (
            <li key={pedido.id}>
              <Link href={`/pedidos/${pedido.id}`} className="flex flex-col gap-1 px-4 py-3 active:bg-brand-light">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-semibold text-ink">
                    {pedido.numero} · {pedido.cliente}
                  </span>
                  <span className="text-base font-bold text-ink">{formatTotal(pedido.totalCentavos)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted">
                    {CANAIS_VENDA[pedido.canal]} · {formatQuantidade(pedido.itens)}{' '}
                    {pedido.itens === 1 ? 'item' : 'itens'} · {formatDateTime(pedido.criadoEm)}
                    {pedido.dataEntrega &&
                      ` · entrega ${formatData(pedido.dataEntrega)} · carregar ${formatData(diaUtilAnterior(pedido.dataEntrega))}`}
                  </span>
                  <Pill tone={TOM[pedido.situacao]}>{SITUACOES_PEDIDO[pedido.situacao]}</Pill>
                </div>

                {/* T8.15: de quem o pedido está esperando, o que há a fazer e
                    quanto corre. */}
                {pedido.situacao !== 'cancelado' && pedido.situacao !== 'pronto_envio' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {DONO_SITUACAO[pedido.situacao] && (
                      <span className="text-sm text-muted">
                        esperando {PERFIL_LABELS[DONO_SITUACAO[pedido.situacao]!].toLowerCase()}
                      </span>
                    )}
                    {PROVIDENCIA[pedido.situacao] && <Pill tone="blue">{PROVIDENCIA[pedido.situacao]}</Pill>}
                    {(() => {
                      const urgencia = urgenciaPedido(
                        hoje,
                        pedido.dataEntrega,
                        pedido.dataEntrega ? diaUtilAnterior(pedido.dataEntrega) : null,
                      );
                      return urgencia ? <Pill tone="amber">{ROTULO_URGENCIA[urgencia]}</Pill> : null;
                    })()}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
