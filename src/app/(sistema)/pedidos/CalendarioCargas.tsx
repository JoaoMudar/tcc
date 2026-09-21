'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface DiaDoPedido {
  id: string;
  numero: number;
  cliente: string;
  dataEntrega: string;
  /** Dia útil anterior à entrega, calculado no servidor. */
  diaDeCarregar: string;
  situacao: string;
  cargas: number;
  prontas: number;
}

interface CalendarioCargasProps {
  /** Primeiro dia do mês exibido, `AAAA-MM-DD`. */
  mes: string;
  hoje: string;
  pedidos: readonly DiaDoPedido[];
}

const DIAS_DA_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

/** Segunda é 0 e domingo é 6: a semana do viveiro começa na segunda. */
function colunaDe(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function diasDoMes(mes: string): string[] {
  const [ano, mesNumero] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, mesNumero, 0)).getUTCDate();
  return Array.from({ length: ultimo }, (_, i) => `${mes.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`);
}

/**
 * T8.15: o mês de quem carrega caminhão.
 *
 * Três cores, e cada uma responde a uma pergunta diferente: **amarelo** é dia de
 * entrega, **verde** é dia de carregar, e **vermelho** é entrega que passou com
 * o pedido ainda não pronto. Sem o verde, o calendário diria quando a muda
 * precisa chegar e não quando alguém tem de estar no galpão, que é o dia que
 * realmente se planeja.
 *
 * Grade em CSS, sem biblioteca: são 42 células e um contador.
 */
export function CalendarioCargas({ mes, hoje, pedidos }: CalendarioCargasProps) {
  const [aberto, setAberto] = useState<string | null>(null);

  const entregas = new Map<string, DiaDoPedido[]>();
  const carregamentos = new Map<string, DiaDoPedido[]>();
  for (const pedido of pedidos) {
    entregas.set(pedido.dataEntrega, [...(entregas.get(pedido.dataEntrega) ?? []), pedido]);
    carregamentos.set(pedido.diaDeCarregar, [...(carregamentos.get(pedido.diaDeCarregar) ?? []), pedido]);
  }

  const dias = diasDoMes(mes);
  const vazias = colunaDe(dias[0]);
  const doDia = aberto ? [...(entregas.get(aberto) ?? []), ...(carregamentos.get(aberto) ?? [])] : [];
  const vistos = new Set<string>();
  const doDiaUnicos = doDia.filter((pedido) => !vistos.has(pedido.id) && vistos.add(pedido.id));

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Entregas e carregamentos</h2>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_DA_SEMANA.map((dia) => (
          <span key={dia} className="py-1 text-center text-sm font-semibold text-muted">
            {dia}
          </span>
        ))}

        {Array.from({ length: vazias }, (_, i) => (
          <span key={`vazia-${i}`} />
        ))}

        {dias.map((dia) => {
          const entrega = entregas.get(dia) ?? [];
          const carregar = carregamentos.get(dia) ?? [];
          // Entrega que passou com o pedido ainda não pronto é o que precisa saltar
          const atrasada = entrega.some((p) => dia < hoje && p.situacao !== 'pronto_envio');
          const cor = atrasada
            ? 'bg-red-200 text-red-900 font-bold'
            : entrega.length > 0
              ? 'bg-amber-200 text-amber-900 font-bold'
              : carregar.length > 0
                ? 'bg-green-200 text-green-900 font-bold'
                : 'text-ink';
          const marcado = dia === hoje ? 'ring-2 ring-brand' : '';

          return (
            <button
              key={dia}
              type="button"
              onClick={() => setAberto(aberto === dia ? null : dia)}
              aria-pressed={aberto === dia}
              className={`min-h-touch rounded-lg text-base ${cor} ${marcado} active:bg-brand-light`}
            >
              {Number(dia.slice(-2))}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted">
        Amarelo: entrega · Verde: dia de carregar · Vermelho: entrega passou sem o pedido ficar pronto
      </p>

      {aberto && (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          {doDiaUnicos.length === 0 ? (
            <p className="text-base text-muted">Nada marcado neste dia.</p>
          ) : (
            doDiaUnicos.map((pedido) => (
              <Link key={pedido.id} href={`/pedidos/${pedido.id}`} className="text-base text-ink active:underline">
                <strong>{pedido.numero}</strong> · {pedido.cliente} ·{' '}
                {pedido.dataEntrega === aberto ? 'entrega' : 'carregar'} ·{' '}
                {pedido.cargas === 0 ? 'sem carga organizada' : `${pedido.prontas}/${pedido.cargas} carga(s) pronta(s)`}
              </Link>
            ))
          )}
        </div>
      )}
    </section>
  );
}
