'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { AtribuicaoResumo } from '@/lib/agenda';
import { opcoesDeHora } from '@/lib/agenda-grade';
import type { Mudanca } from '@/lib/agenda-linhas';
import { ESTADOS_TAREFA, detalhesAtribuicao, estadoTarefa, formatQuantidadeMedida } from '@/lib/agenda-rotulos';
import { COR_CATEGORIA } from '@/lib/cores-categoria';
import { formatData } from '@/lib/datas';
import { nomeDia } from '@/lib/semanas';
import { CATEGORIA_TAREFA_LABELS } from '@/lib/tipos-tarefa';
import { type Turno, turnoLabel } from '@/lib/turnos';
import { BotaoConfirmar } from './BotaoConfirmar';
import { EXPLICACAO, IconeEstado } from './IconeEstado';

interface PainelTarefaProps {
  atribuicao: AtribuicaoResumo;
  turnos: readonly Turno[];
  /** Alterar a agenda: a hora só se edita aqui na tarefa planejada de semana aberta. */
  podeAlterar: boolean;
  podeConfirmar: boolean;
  onFechar: () => void;
  onMudar: (mudanca: Mudanca) => void;
}

const SEM_HORA = '';

/**
 * Os detalhes da tarefa sem sair da semana: painel à direita na tela larga,
 * folha de baixo no celular. Edita só a hora, de quinze em quinze minutos; o
 * resto (tipo, grupo, lote, quantidade) continua no formulário, pelo "Alterar".
 */
export function PainelTarefa({ atribuicao: a, turnos, podeAlterar, podeConfirmar, onFechar, onMudar }: PainelTarefaProps) {
  const tituloId = useId();
  const caixaRef = useRef<HTMLDivElement>(null);
  const [inicio, setInicio] = useState(a.horaInicio ?? SEM_HORA);
  const [fim, setFim] = useState(a.horaFim ?? SEM_HORA);
  const estado = estadoTarefa(a);
  const editavel = podeAlterar && a.situacao === 'planejada' && a.semanaSituacao === 'aberta';
  const horas = opcoesDeHora(turnos);
  const detalhes = detalhesAtribuicao(a);
  const mudou = inicio !== (a.horaInicio ?? SEM_HORA) || fim !== (a.horaFim ?? SEM_HORA);

  // O foco vai para o painel ao abrir, e Esc o fecha também sem a grade por trás
  useEffect(() => {
    caixaRef.current?.focus();
  }, [a.id]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/30 md:pointer-events-none md:bg-transparent" onClick={onFechar}>
      <div
        ref={caixaRef}
        role="dialog"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onClick={(evento) => evento.stopPropagation()}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') {
            evento.stopPropagation();
            onFechar();
          }
        }}
        className="pointer-events-auto flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl outline-none md:fixed md:inset-y-0 md:right-0 md:max-h-none md:w-96 md:rounded-none md:border-l md:border-line md:shadow-lg"
      >
        <div aria-hidden className="mx-auto h-1 w-9 rounded bg-gray-300 md:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${COR_CATEGORIA[a.categoria]}`} />
              {CATEGORIA_TAREFA_LABELS[a.categoria]}
            </span>
            <h2 id={tituloId} className="text-lg font-semibold break-words text-ink">
              {a.tipo}
            </h2>
            <span className="text-sm text-muted">
              {nomeDia(a.data)}, {formatData(a.data)} · {turnoLabel(a.turno)}
            </span>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="-mt-1 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-muted hover:bg-surface"
          >
            ×
          </button>
        </div>

        {estado !== 'planejada' && (
          <p className="flex items-center gap-2 text-sm text-ink">
            <IconeEstado estado={estado} />
            {EXPLICACAO[estado] ?? ESTADOS_TAREFA[estado]}
          </p>
        )}

        {editavel ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(evento) => {
              evento.preventDefault();
              const horaInicio = inicio || null;
              onMudar({ id: a.id, dia: a.data, turnoId: a.turnoId, horaInicio, horaFim: horaInicio ? fim || null : null });
            }}
          >
            <span className="text-sm font-semibold text-ink">Hora marcada</span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Início"
                value={inicio}
                onChange={(evento) => {
                  setInicio(evento.target.value);
                  if (!evento.target.value || (fim && fim <= evento.target.value)) setFim(SEM_HORA);
                }}
                className="min-h-11 flex-1 rounded-lg border border-line bg-white px-2 text-base tabular-nums"
              >
                <option value={SEM_HORA}>Sem hora</option>
                {horas.map((hora) => (
                  <option key={hora} value={hora}>
                    {hora}
                  </option>
                ))}
              </select>
              <span className="text-muted">–</span>
              <select
                aria-label="Fim"
                value={fim}
                disabled={!inicio}
                onChange={(evento) => setFim(evento.target.value)}
                className="min-h-11 flex-1 rounded-lg border border-line bg-white px-2 text-base tabular-nums disabled:bg-surface disabled:text-muted"
              >
                <option value={SEM_HORA}>Sem fim</option>
                {horas
                  .filter((hora) => hora > inicio)
                  .map((hora) => (
                    <option key={hora} value={hora}>
                      {hora}
                    </option>
                  ))}
              </select>
            </div>
            <p className="text-xs text-muted">A maioria das tarefas não tem hora: o turno basta.</p>
            {mudou && (
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center self-start rounded-lg bg-brand px-4 text-sm font-semibold text-white active:bg-brand-dark"
              >
                Salvar hora
              </button>
            )}
          </form>
        ) : (
          (a.horaInicio || a.horaFim) && (
            <p className="text-sm text-ink tabular-nums">
              {a.horaInicio}
              {a.horaFim && `–${a.horaFim}`}
            </p>
          )
        )}

        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Quem</h3>
          {a.participantes.length === 0 ? (
            <p className="text-sm text-atencao">Ninguém escalado.</p>
          ) : (
            <ul className="text-sm text-ink">
              {a.participantes.map((p) => (
                <li key={p.id}>
                  {p.nome}
                  {p.quantidade !== null && <span className="text-muted"> · {formatQuantidadeMedida(p.quantidade, a.unidadeMedida)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {detalhes.length > 0 && <p className="text-sm text-muted">{detalhes.join(' · ')}</p>}
        {a.observacoes && <p className="text-sm whitespace-pre-line text-ink">{a.observacoes}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {estado === 'planejada' && podeConfirmar && a.participantes.length > 0 && a.semanaSituacao === 'aberta' && (
            <span className="flex items-center gap-2 text-sm text-ink">
              <BotaoConfirmar atribuicao={a} podeConfirmar={podeConfirmar} />
              Feita
            </span>
          )}
          <Link href={`/producao/agenda/${a.id}`} className="text-sm font-semibold text-brand-dark underline-offset-2 hover:underline">
            Abrir ficha
          </Link>
          {editavel && (
            <Link
              href={`/producao/agenda/${a.id}/editar`}
              className="text-sm font-semibold text-brand-dark underline-offset-2 hover:underline"
            >
              Alterar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
