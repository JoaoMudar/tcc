'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SituacaoViagem } from '@/lib/rotas';

export interface DiaDoPedido {
  id: string;
  numero: number;
  cliente: string;
  dataEntrega: string;
  situacao: string;
  cargas: number;
  prontas: number;
}

export interface ViagemEmAndamento {
  id: string;
  data: string;
  situacao: SituacaoViagem;
}

interface CalendarioCargasProps {
  /** Primeiro dia do mês exibido, `AAAA-MM-DD`. */
  mes: string;
  hoje: string;
  pedidos: readonly DiaDoPedido[];
  /** P14: viagens começadas e não terminadas, de qualquer mês. */
  viagens?: readonly ViagemEmAndamento[];
  /** Dias em que toda viagem chegou a "pronta": a entrega está configurada. */
  diasProntos?: readonly string[];
}

function planejar(dia: string): string {
  return `/pedidos/planejar/${dia}`;
}

const COR_ATRASADA = 'bg-red-200 text-red-900';
const COR_PRONTA = 'bg-green-200 text-green-900';
const COR_A_CONFIGURAR = 'bg-amber-200 text-amber-900';

const LEGENDA = [
  { cor: COR_A_CONFIGURAR, texto: 'não confirmada' },
  { cor: COR_PRONTA, texto: 'entrega' },
  { cor: COR_ATRASADA, texto: 'atrasada' },
];

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
 * Só o dia de entrega ganha cor, e a cor diz em que pé está: **amarelo** é
 * entrega cuja viagem ainda não chegou a "pronta" (nem começou, ou parou em
 * Carga, Rota ou Carregamento), **verde** é entrega com a viagem pronta, e
 * **vermelho** é entrega que passou com o pedido ainda não pronto.
 *
 * Grade em CSS, sem biblioteca: são 42 células e um contador.
 *
 * P14: o dia com entrega abre a rotina "Planejar pedido". O dia com viagem em
 * andamento fica amarelo mesmo sem pedido, ganha um ponto e também abre a
 * rotina: é por ele que se continua a viagem. Os outros dias abrem o painel,
 * que também oferece planejar uma entrega ali.
 */
export function CalendarioCargas({ mes, hoje, pedidos, viagens = [], diasProntos = [] }: CalendarioCargasProps) {
  const [aberto, setAberto] = useState<string | null>(null);

  const entregas = new Map<string, DiaDoPedido[]>();
  for (const pedido of pedidos) {
    entregas.set(pedido.dataEntrega, [...(entregas.get(pedido.dataEntrega) ?? []), pedido]);
  }

  const comViagem = new Set(viagens.map((viagem) => viagem.data));
  const prontos = new Set(diasProntos);
  const dias = diasDoMes(mes);
  const vazias = colunaDe(dias[0]);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Entregas</h2>

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
          // Entrega que passou com o pedido ainda não pronto é o que precisa saltar
          const atrasada = entrega.some((p) => dia < hoje && p.situacao !== 'pronto_envio');
          const cor = atrasada
            ? `${COR_ATRASADA} font-bold`
            : entrega.length === 0 && !comViagem.has(dia)
              ? 'text-ink'
              : `${prontos.has(dia) ? COR_PRONTA : COR_A_CONFIGURAR} font-bold`;
          const marcado = dia === hoje ? 'ring-2 ring-brand' : '';
          const classe = `flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-lg text-base ${cor} ${marcado} active:bg-brand-light`;
          const conteudo = (
            <>
              <span>{Number(dia.slice(-2))}</span>
              {comViagem.has(dia) && (
                <span aria-label="viagem em andamento" className="h-1.5 w-1.5 rounded-full bg-brand-dark" />
              )}
            </>
          );

          // Dia com entrega, ou com viagem começada, vai direto para a rotina
          if (entrega.length > 0 || comViagem.has(dia)) {
            return (
              <Link key={dia} href={planejar(dia)} className={classe}>
                {conteudo}
              </Link>
            );
          }
          return (
            <button
              key={dia}
              type="button"
              onClick={() => setAberto(aberto === dia ? null : dia)}
              aria-pressed={aberto === dia}
              className={classe}
            >
              {conteudo}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {LEGENDA.map(({ cor, texto }) => (
          <li key={texto} className="flex items-center gap-2">
            <span aria-hidden className={`inline-block h-3 w-3 shrink-0 rounded-sm ${cor}`} />
            {texto}
          </li>
        ))}
      </ul>

      {aberto && (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          {/* O painel só abre em dia sem entrega: o dia com entrega já vai para a rotina */}
          <p className="text-base text-muted">Nada marcado neste dia.</p>
          <Link
            href={planejar(aberto)}
            className="flex min-h-touch items-center justify-center rounded-xl border-2 border-brand bg-white px-4 text-base font-bold text-brand active:bg-brand-light"
          >
            Planejar entrega neste dia
          </Link>
        </div>
      )}
    </section>
  );
}
