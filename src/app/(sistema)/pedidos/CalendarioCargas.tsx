'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SITUACOES_VIAGEM, type SituacaoViagem } from '@/lib/rotas';

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
}

function planejar(dia: string): string {
  return `/pedidos/planejar/${dia}`;
}

function diaEMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
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
 *
 * P14: o dia com entrega abre a rotina "Planejar pedido", e o dia com viagem em
 * andamento ganha um ponto. Os outros dias abrem o painel, que também oferece
 * planejar uma entrega ali.
 */
export function CalendarioCargas({ mes, hoje, pedidos, viagens = [] }: CalendarioCargasProps) {
  const [aberto, setAberto] = useState<string | null>(null);

  const entregas = new Map<string, DiaDoPedido[]>();
  const carregamentos = new Map<string, DiaDoPedido[]>();
  for (const pedido of pedidos) {
    entregas.set(pedido.dataEntrega, [...(entregas.get(pedido.dataEntrega) ?? []), pedido]);
    carregamentos.set(pedido.diaDeCarregar, [...(carregamentos.get(pedido.diaDeCarregar) ?? []), pedido]);
  }

  const comViagem = new Set(viagens.map((viagem) => viagem.data));
  const dias = diasDoMes(mes);
  const vazias = colunaDe(dias[0]);
  const doDia = aberto ? [...(entregas.get(aberto) ?? []), ...(carregamentos.get(aberto) ?? [])] : [];
  const vistos = new Set<string>();
  const doDiaUnicos = doDia.filter((pedido) => !vistos.has(pedido.id) && vistos.add(pedido.id));

  return (
    <>
      {viagens.map((viagem) => (
        <section
          key={viagem.id}
          className="flex items-center gap-3 rounded-xl border border-brand-muted bg-white py-3 pr-3 pl-4"
        >
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-base font-bold text-ink">Entrega de {diaEMes(viagem.data)}</span>
            <span className="text-sm text-muted">Parou em {SITUACOES_VIAGEM[viagem.situacao]}</span>
          </span>
          <Link
            href={planejar(viagem.data)}
            className="flex min-h-11 shrink-0 items-center rounded-lg bg-brand px-4 text-base font-bold text-white active:bg-brand-dark"
          >
            Continuar
          </Link>
        </section>
      ))}
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
            <Link
              href={planejar(aberto)}
              className="flex min-h-touch items-center justify-center rounded-xl border-2 border-brand bg-white px-4 text-base font-bold text-brand active:bg-brand-light"
            >
              Planejar entrega neste dia
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
