'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useOptimistic, useRef, useState } from 'react';
import type { AtribuicaoResumo, Funcionario } from '@/lib/agenda';
import { type Mudanca, aplicarMudanca, dadosDaMudanca, montarGrade } from '@/lib/agenda-linhas';
import { estadoNaGrade, formatHoraTarefa } from '@/lib/agenda-rotulos';
import { COR_CATEGORIA } from '@/lib/cores-categoria';
import { somaDias } from '@/lib/datas';
import { nomeDia, siglaDia } from '@/lib/semanas';
import type { Turno } from '@/lib/turnos';
import { BotaoConfirmar } from './BotaoConfirmar';
import { IconeEstado } from './IconeEstado';
import { PainelTarefa } from './PainelTarefa';
import { type AvisoDesfazer, ToastDesfazer } from './ToastDesfazer';
import { reagendarAtribuicaoAction } from './actions';

interface AgendaDiaCelularProps {
  atribuicoes: AtribuicaoResumo[];
  funcionarios: Funcionario[];
  /** Os dias do seletor: segunda a sexta, e sábado e domingo só quando têm tarefa. */
  dias: string[];
  dia: string;
  hoje: string;
  turnos: Turno[];
  podeConfirmar: boolean;
  podeAlterar: boolean;
  /** A semana já pode ser fechada: a não confirmada fica âmbar com "?", a confirmada verde. */
  aFechar?: boolean;
  /** Lançar tarefa no dia, quando a pessoa pode e a semana está aberta. */
  lancarHref?: string;
  className?: string;
}

/** Quanto o dedo precisa andar na horizontal para trocar de dia. */
const LIMIAR_DESLIZE = 50;

/**
 * A agenda no celular (RNF-14): não é a grade encolhida, é a lista de um dia,
 * agrupada por pessoa. Deslizar troca o dia; o quadrado à direita marca feito
 * num toque (RF-29); tocar na tarefa abre a folha com os detalhes.
 */
export function AgendaDiaCelular({
  atribuicoes,
  funcionarios,
  dias,
  dia,
  hoje,
  turnos,
  podeConfirmar,
  podeAlterar,
  aFechar = false,
  lancarHref,
  className = '',
}: AgendaDiaCelularProps) {
  const router = useRouter();
  const [lista, aplicarOtimista] = useOptimistic(atribuicoes, aplicarMudanca);
  const [aberta, setAberta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoDesfazer | null>(null);
  const toque = useRef<{ x: number; y: number } | null>(null);
  const fecharAviso = useCallback(() => setAviso(null), []);

  const doDia = lista.filter((a) => a.data === dia);
  const grade = montarGrade(funcionarios, doDia);
  const comTarefa = grade.filter((linha) => Object.keys(linha.porDia).length > 0);
  const semTarefa = grade.filter((linha) => linha.pessoa && Object.keys(linha.porDia).length === 0);
  const tarefaAberta = aberta ? lista.find((a) => a.id === aberta) : undefined;

  const irPara = (novo: string) => router.push(`/producao?dia=${novo}`, { scroll: false });

  const mudarHora = (mudanca: Mudanca) => {
    startTransition(async () => {
      aplicarOtimista(mudanca);
      const estado = await reagendarAtribuicaoAction({}, dadosDaMudanca(mudanca));
      setAviso({ texto: estado.error ?? 'Hora salva.', tom: estado.error ? 'erro' : 'info' });
    });
  };

  return (
    <div
      className={`flex flex-col gap-4 ${className}`}
      onTouchStart={(evento) => {
        const dedo = evento.touches[0];
        toque.current = { x: dedo.clientX, y: dedo.clientY };
      }}
      onTouchEnd={(evento) => {
        const inicio = toque.current;
        toque.current = null;
        if (!inicio) return;
        const dedo = evento.changedTouches[0];
        const dx = dedo.clientX - inicio.x;
        // Rolar a lista na vertical não é trocar de dia
        if (Math.abs(dx) < LIMIAR_DESLIZE || Math.abs(dx) < Math.abs(dedo.clientY - inicio.y)) return;
        irPara(somaDias(dia, dx < 0 ? 1 : -1));
      }}
    >
      <nav aria-label="Dia da semana" className="grid gap-1" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}>
        {dias.map((d) => (
          <Link
            key={d}
            href={`/producao?dia=${d}`}
            scroll={false}
            aria-current={d === dia ? 'date' : undefined}
            aria-label={`${nomeDia(d)}, ${d.slice(8)}`}
            className={`flex min-h-12 flex-col items-center justify-center rounded-lg text-xs font-semibold ${
              d === dia ? 'bg-brand text-white' : d === hoje ? 'bg-brand-light text-brand-dark' : 'text-muted'
            }`}
          >
            <span>{siglaDia(d).charAt(0)}</span>
            <span className="text-sm tabular-nums">{d.slice(8)}</span>
          </Link>
        ))}
      </nav>

      <h3 className="text-sm font-semibold text-ink">
        {nomeDia(dia)}
        {dia === hoje && <span className="font-normal text-muted"> · hoje</span>}
      </h3>

      {comTarefa.length === 0 ? (
        <p className="text-sm text-muted">
          Nada lançado neste dia.
          {lancarHref && (
            <>
              {' '}
              <Link href={lancarHref} className="font-semibold text-brand-dark underline underline-offset-2">
                Lançar tarefa
              </Link>
            </>
          )}
        </p>
      ) : (
        comTarefa.map((linha) => (
          <section key={linha.pessoa?.id ?? 'sem-ninguem'} className="flex flex-col gap-1.5">
            <h4 className={`text-xs font-semibold tracking-wide uppercase ${linha.pessoa ? 'text-muted' : 'text-atencao'}`}>
              {linha.pessoa?.nome ?? 'Sem ninguém'}
            </h4>
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-white">
              {(linha.porDia[dia] ?? []).map((a) => {
                const estado = estadoNaGrade(a, aFechar);
                const hora = formatHoraTarefa(a.horaInicio, a.horaFim)?.replace(' às ', '–');
                // Na semana a fechar, a faixa e o fundo dizem o que o fechamento vai fazer
                const confirmada = estado === 'feita' || estado === 'parcial' || estado === 'nao_feita';
                const tom = !aFechar ? null : estado === 'presumida' ? 'presumida' : confirmada ? 'confirmada' : null;
                const faixa = tom === 'presumida' ? 'bg-atencao' : tom === 'confirmada' ? 'bg-feito' : COR_CATEGORIA[a.categoria];
                const fundo = tom === 'presumida' ? 'bg-amber-50' : tom === 'confirmada' ? 'bg-green-50' : '';
                return (
                  <li key={a.id} className={`relative flex items-center gap-2 py-1 pr-1.5 pl-3 ${fundo}`}>
                    <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${faixa}`} />
                    <button
                      type="button"
                      onClick={() => setAberta(a.id)}
                      className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left"
                    >
                      <span
                        className={`text-base font-medium break-words ${estado === 'feita' || estado === 'cancelada' ? 'text-muted' : 'text-ink'} ${
                          estado === 'cancelada' ? 'line-through' : ''
                        }`}
                      >
                        {a.tipo}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {hora && <span className="text-sm text-muted tabular-nums">{hora}</span>}
                        {estado === 'presumida' && <IconeEstado estado={estado} className="text-base" />}
                      </span>
                    </button>
                    <BotaoConfirmar atribuicao={a} podeConfirmar={podeConfirmar} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {comTarefa.length > 0 && semTarefa.length > 0 && (
        <p className="text-sm text-atencao">Sem tarefa: {semTarefa.map((linha) => linha.pessoa!.nome).join(', ')}.</p>
      )}

      {tarefaAberta && (
        <PainelTarefa
          key={tarefaAberta.id}
          atribuicao={tarefaAberta}
          turnos={turnos}
          podeAlterar={podeAlterar}
          podeConfirmar={podeConfirmar}
          onFechar={() => setAberta(null)}
          onMudar={mudarHora}
        />
      )}
      <ToastDesfazer aviso={aviso} onFechar={fecharAviso} />
    </div>
  );
}
