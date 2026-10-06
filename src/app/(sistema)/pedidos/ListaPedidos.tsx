'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
}

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
 * RF-58: a carteira, filtrada pelo cliente enquanto se digita. O campo é o
 * mesmo do novo pedido, e a lista dele só traz quem tem pedido aqui: escolher
 * um cliente sem pedido seria escolher uma tela vazia.
 */
export function ListaPedidos({ pedidos, hoje }: ListaPedidosProps) {
  const [clienteId, setClienteId] = useState('');
  const [texto, setTexto] = useState('');

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
                    {pedido.dataEntrega && ` · entrega ${formatData(pedido.dataEntrega)}`}
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
