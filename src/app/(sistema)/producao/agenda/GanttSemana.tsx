'use client';

import Link from 'next/link';
import { type MouseEvent, startTransition, useCallback, useEffect, useMemo, useOptimistic, useRef, useState } from 'react';
import type { AtribuicaoResumo, Funcionario } from '@/lib/agenda';
import {
  type Barra,
  type Degrau,
  type Eixo,
  type Faixa,
  type Trecho,
  OVERLAP_SECONDARY,
  PASSO_MINUTOS,
  agruparPorTarefa,
  ancorasDaJornada,
  comparaPrecedencia,
  duracaoUtil,
  faixaDaBarra,
  faixaVertical,
  formatMinuto,
  janelaDoDia,
  marcasDeHora,
  minutoNaPosicao,
  ocupacaoDoDia,
  percentualDoMinuto,
  posicaoPercentual,
  sobrepor,
  turnoParaMinuto,
  vaoParaLancar,
} from '@/lib/agenda-grade';
import { diasDaJanela, passoDoZoom, zoomVizinho } from '@/lib/agenda-zoom';
import { type Mudanca, aplicarMudanca, dadosDaMudanca, montarGrade, prioridadeAgora } from '@/lib/agenda-linhas';
import { COR_CATEGORIA } from '@/lib/cores-categoria';
import { nomeDia, siglaDia } from '@/lib/semanas';
import { type Turno, formatDuracao, jornadaDiaria, turnoLabel } from '@/lib/turnos';
import { type OpcoesAtribuicao } from './AtribuicaoForm';
import { BarraTarefa, intervalo } from './BarraTarefa';
import { LinhaAgora } from './LinhaAgora';
import { NovaTarefaModal, type PontoDaAgenda } from './NovaTarefaModal';
import { type AvisoDesfazer, ToastDesfazer } from './ToastDesfazer';
import { promoverAtribuicaoAction, reagendarAtribuicaoAction } from './actions';
import { ATRIBUTO_DIA, ATRIBUTO_LINHA, type Reagendamento, useArrasteBarra } from './useArrasteBarra';
import { useAtalhosSemana } from './useAtalhosSemana';
import { useZoomAgenda } from './ZoomAgenda';

interface GanttSemanaProps {
  atribuicoes: AtribuicaoResumo[];
  funcionarios: Funcionario[];
  /** Os dias úteis da semana: o zoom recorta deles a janela que a grade desenha. */
  dias: string[];
  /** O dia escolhido: é o meio da janela nos zooms 3 dias e Dia. Sem ele, hoje. */
  dia?: string;
  /** Os turnos em uso, mais o desativado que ainda tem tarefa nesta semana. */
  turnos: Turno[];
  hoje: string;
  semana: string;
  /** Arrastar remarca, e exige alterar a agenda em semana aberta. */
  podeArrastar?: boolean;
  /** As listas do formulário: só chegam quando se pode lançar. */
  opcoes?: OpcoesAtribuicao;
  className?: string;
}

/** Altura da linha da pessoa, em pixels. É fixa: a sobreposição divide a altura, e não a aumenta (RF-26). */
const ALTURA_LINHA = 60;
/** Abaixo disto a faixa secundária não comporta uma linha de texto, e a tarefa vai para o "+N". */
const ALTURA_MINIMA_FAIXA = 16;
const MAX_CAMADAS = 1 + Math.floor((ALTURA_LINHA * OVERLAP_SECONDARY) / ALTURA_MINIMA_FAIXA);
/** O dia sob o mouse cresce até esta proporção dos outros, e eles encolhem; a grade não muda de largura. */
export const HOVER_EXPAND = 1.6;
/** Quanto o mouse precisa parar no dia antes de ele crescer: atravessar a grade não faz nada pular. */
const ESPERA_FOCO_MS = 150;
/** Quanto de roda com Ctrl vale um passo de zoom, e o intervalo mínimo entre dois passos: a pinça do touchpad manda muitos eventos pequenos. */
const LIMIAR_RODA = 60;
const INTERVALO_RODA_MS = 250;
const LARGURA_NOME = 'w-36';

/** As colunas dos dias, com a do foco maior. Cabeçalho e linhas usam a mesma, ou desalinham. */
function colunasDaGrade(quantos: number, foco: number | null): string {
  return Array.from({ length: quantos }, (_, indice) => `minmax(0, ${indice === foco ? HOVER_EXPAND : 1}fr)`).join(' ');
}

/**
 * T5.1, F1 UC-19: a semana como Gantt, uma linha por pessoa e o dia como eixo de
 * hora (RNF-14), sem o almoço, que vira um divisor. O dia sob o mouse cresce, e
 * nele cabem todas as horas e os títulos inteiros. Arrastar a barra remarca o dia
 * e a hora, e para a linha de outra pessoa troca quem faz (RN-61); puxar a borda
 * muda a duração; perto das bordas da jornada a barra se imanta. Duas tarefas ao
 * mesmo tempo dividem a altura da linha: a principal em cima, a outra embaixo, e
 * qualquer uma pode virar a principal (RF-26). Clicar em qualquer vazio lança
 * tarefa já com pessoa, dia, turno e, se o turno já tem tarefa, a hora livre. No
 * celular a página mostra a lista do dia.
 */
export function GanttSemana({
  atribuicoes,
  funcionarios,
  dias: diasUteis,
  turnos,
  hoje,
  dia = hoje,
  semana,
  podeArrastar = false,
  opcoes,
  className = '',
}: GanttSemanaProps) {
  const janela = useMemo(() => janelaDoDia(turnos), [turnos]);
  const ancoras = useMemo(() => ancorasDaJornada(turnos), [turnos]);
  const jornada = jornadaDiaria(turnos);
  const [lista, aplicarOtimista] = useOptimistic(atribuicoes, aplicarMudanca);
  const [ponto, setPonto] = useState<PontoDaAgenda | null>(null);
  const [aviso, setAviso] = useState<AvisoDesfazer | null>(null);
  /** O último horário produzido, para quem não vê a etiqueta (RNF-03). */
  const [anuncio, setAnuncio] = useState('');
  const fecharAviso = useCallback(() => setAviso(null), []);

  // O zoom recorta a semana; as setas do teclado andam no passo dele, como as do cabeçalho
  const { zoom, setZoom } = useZoomAgenda();
  const dias = useMemo(() => diasDaJanela(zoom, dia, diasUteis), [zoom, dia, diasUteis]);
  useAtalhosSemana({
    anterior: `/producao?dia=${passoDoZoom(zoom, dia, -1)}`,
    proxima: `/producao?dia=${passoDoZoom(zoom, dia, 1)}`,
    hoje: '/producao',
  });

  // Ctrl + roda sobre a grade troca o zoom. O onWheel do React é passivo e não impediria o zoom do navegador
  const gradeRef = useRef<HTMLDivElement>(null);
  const roda = useRef({ acumulado: 0, ultimo: -Infinity });
  useEffect(() => {
    const grade = gradeRef.current;
    if (!grade) return;
    const aoRolar = (evento: WheelEvent) => {
      if (!evento.ctrlKey) return;
      evento.preventDefault();
      const estado = roda.current;
      // Logo depois de um passo, o resto do mesmo gesto se descarta
      if (Date.now() - estado.ultimo < INTERVALO_RODA_MS) return;
      estado.acumulado += evento.deltaY;
      if (Math.abs(estado.acumulado) < LIMIAR_RODA) return;
      // Roda para cima aproxima
      const novo = zoomVizinho(zoom, estado.acumulado < 0 ? 1 : -1);
      estado.acumulado = 0;
      estado.ultimo = Date.now();
      if (novo !== zoom) setZoom(novo);
    };
    grade.addEventListener('wheel', aoRolar, { passive: false });
    return () => grade.removeEventListener('wheel', aoRolar);
  }, [zoom, setZoom]);

  /** A tarefa vai para o lugar novo antes da resposta; o erro a devolve e diz por quê. */
  const mandar = useCallback(
    async (mudanca: Mudanca) => {
      aplicarOtimista(mudanca);
      return reagendarAtribuicaoAction({}, dadosDaMudanca(mudanca));
    },
    [aplicarOtimista],
  );

  const enviar = useCallback(
    (mudanca: Mudanca, texto: string, volta: Mudanca | null) => {
      const desfazer = volta
        ? () =>
            startTransition(async () => {
              const estado = await mandar(volta);
              setAviso(estado.error ? { texto: estado.error, tom: 'erro' } : { texto: 'Desfeito.', tom: 'info' });
            })
        : undefined;
      startTransition(async () => {
        const estado = await mandar(mudanca);
        setAviso(estado.error ? { texto: estado.error, tom: 'erro' } : { texto, tom: 'info', desfazer });
      });
    },
    [mandar],
  );

  // Ctrl+Z desfaz o mesmo que o botão do aviso, enquanto o aviso está na tela
  useEffect(() => {
    const desfazer = aviso?.desfazer;
    if (!desfazer) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (!(evento.ctrlKey || evento.metaKey) || evento.shiftKey || evento.key.toLowerCase() !== 'z') return;
      const alvo = evento.target;
      if (alvo instanceof HTMLElement && (alvo.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(alvo.tagName))) return;
      evento.preventDefault();
      setAviso(null);
      desfazer();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aviso]);

  const soltar = useCallback(
    (r: Reagendamento) => {
      const a = lista.find((t) => t.id === r.id);
      if (!a) return;
      const turno = r.mudouHora ? turnoParaMinuto(r.faixa.inicio, turnos) : turnos.find((t) => t.id === a.turnoId);
      if (!turno) return;

      const trocaPessoa = r.pessoa !== r.pessoaOriginal;
      const entra = trocaPessoa ? funcionarios.find((f) => f.id === r.pessoa) : undefined;
      if (trocaPessoa && !entra) return;
      if (entra && a.participantes.some((p) => p.id === entra.id)) {
        setAviso({ texto: `${entra.nome} já está nesta tarefa.`, tom: 'erro' });
        return;
      }
      const saiu = a.participantes.find((p) => p.id === r.pessoaOriginal);
      // Só a barra que andou no eixo ganha hora: a que mudou só de dia ou de pessoa fica como estava (RN-12)
      const horaInicio = r.mudouHora ? formatMinuto(r.faixa.inicio) : a.horaInicio;
      const horaFim = r.mudouHora ? formatMinuto(r.faixa.fim) : a.horaFim;

      const mudanca: Mudanca = {
        id: a.id,
        dia: r.dia,
        turnoId: turno.id,
        turnoNome: turno.nome,
        horaInicio,
        horaFim,
        troca: entra ? { sai: r.pessoaOriginal, entra } : null,
      };
      // Desfazer a entrada pela linha "Sem ninguém" seria tirar sem pôr, e isso é do formulário
      const volta: Mudanca | null =
        entra && !saiu
          ? null
          : {
              id: a.id,
              dia: a.data,
              turnoId: a.turnoId,
              turnoNome: a.turno,
              horaInicio: a.horaInicio,
              horaFim: a.horaFim,
              troca: entra && saiu ? { sai: entra.id, entra: saiu } : null,
            };
      const quando = horaInicio ? `${horaInicio}${horaFim ? `–${horaFim}` : ''}` : turnoLabel(turno.nome).toLowerCase();
      const partes = [entra && `com ${entra.nome}`, `${nomeDia(r.dia).toLowerCase()}, ${quando}`].filter(Boolean);
      if (r.mudouHora) setAnuncio(intervalo(r.faixa));
      enviar(mudanca, `Tarefa remarcada: ${partes.join(', ')}.`, volta);
    },
    [lista, turnos, funcionarios, enviar],
  );

  /** RF-26: a secundária vira a principal já, e o erro a devolve. */
  const promover = useCallback(
    (id: string) => {
      const a = lista.find((t) => t.id === id);
      if (!a) return;
      startTransition(async () => {
        aplicarOtimista({ id, prioridadeEm: prioridadeAgora() });
        const dados = new FormData();
        dados.set('id', id);
        const estado = await promoverAtribuicaoAction({}, dados);
        setAviso(estado.error ? { texto: estado.error, tom: 'erro' } : { texto: `Principal: ${a.tipo}.`, tom: 'info' });
      });
    },
    [lista, aplicarOtimista],
  );

  const { sessao, iniciar, aoTeclar } = useArrasteBarra({ dias, janela, ancoras, onSoltar: soltar });

  // O dia sob o mouse: cresce depois de uma pausa, e fica parado enquanto há arrasto
  const [foco, setFoco] = useState<number | null>(null);
  const relogioFoco = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apontado = useRef<number | null>(null);
  const emArrastoAgora = sessao !== null;
  const apontar = (indice: number | null) => {
    apontado.current = indice;
    if (relogioFoco.current) clearTimeout(relogioFoco.current);
    relogioFoco.current = null;
    if (emArrastoAgora) return;
    if (indice === null) setFoco(null);
    else relogioFoco.current = setTimeout(() => setFoco(indice), ESPERA_FOCO_MS);
  };
  // Soltou: o foco vai para onde o mouse está agora
  useEffect(() => {
    if (!emArrastoAgora) setFoco(apontado.current);
  }, [emArrastoAgora]);
  useEffect(() => () => {
    if (relogioFoco.current) clearTimeout(relogioFoco.current);
  }, []);

  // A mira do vazio: a faixa de quinze minutos sob o mouse, onde o clique lança
  const [mira, setMira] = useState<{ pessoa: string | null; dia: string; minuto: number } | null>(null);

  const grade = montarGrade(funcionarios, lista);
  const emArrasto = sessao ? lista.find((a) => a.id === sessao.id) : undefined;
  const nomeDe = (pessoa: string | null) => (pessoa === null ? 'Sem ninguém' : (funcionarios.find((f) => f.id === pessoa)?.nome ?? null));

  const faixaDe = (a: AtribuicaoResumo) => faixaDaBarra(a, turnos);
  /** A precedência usa a faixa gravada: puxar a borda não troca quem está em cima no meio do gesto. */
  const compara = (um: AtribuicaoResumo, outro: AtribuicaoResumo) =>
    comparaPrecedencia({ id: um.id, prioridadeEm: um.prioridadeEm, faixa: faixaDe(um) }, { id: outro.id, prioridadeEm: outro.prioridadeEm, faixa: faixaDe(outro) });

  /**
   * Os trechos de uma célula. A que está em arrasto desenha onde o ponteiro está
   * na linha sob ele e, ao mesmo tempo, nas linhas dos colegas de grupo: a tarefa
   * é uma só, e as cópias andam juntas. Sai da linha de origem quando vai para
   * outra pessoa. Movida, fica por cima de tudo; puxada pela borda, guarda a
   * precedência que tem.
   */
  const trechosDe = (pessoa: string | null, dia: string, doDia: readonly AtribuicaoResumo[]): Trecho<AtribuicaoResumo>[] => {
    if (!sessao || !emArrasto) return sobrepor(doDia, faixaDe, compara, MAX_CAMADAS);

    const doGrupo = emArrasto.participantes.some((p) => p.id === pessoa);
    const acompanha = pessoa === sessao.pessoa || (pessoa !== sessao.pessoaOriginal && doGrupo);
    const itens = doDia.filter((a) => a.id !== emArrasto.id);
    if (acompanha && dia === sessao.dia) itens.push(emArrasto);
    const daSessao = (a: AtribuicaoResumo) => a.id === emArrasto.id;
    const porCima = sessao.modo === 'mover';
    return sobrepor(
      itens,
      (a) => (daSessao(a) ? sessao.faixa : faixaDe(a)),
      (um, outro) => (porCima && daSessao(um) ? -1 : porCima && daSessao(outro) ? 1 : compara(um, outro)),
      MAX_CAMADAS,
    );
  };

  /** O clique no vazio: o turno sai do ponto, e a hora, do pedaço livre dele (RN-12). */
  const lancarEm = (evento: MouseEvent<HTMLElement>, pessoa: string | null, dia: string, doDia: readonly AtribuicaoResumo[]) => {
    const rect = evento.currentTarget.getBoundingClientRect();
    // Enter ou espaço no botão não têm ponto: vale o começo do dia
    const minuto =
      evento.detail === 0 || rect.width === 0 ? janela.inicio : minutoNaPosicao((evento.clientX - rect.left) / rect.width, janela);
    const vao = vaoParaLancar(
      minuto,
      turnos,
      doDia.map((a) => faixaDaBarra(a, turnos)),
    );
    if (!vao) return;
    setPonto({ dia, turnoId: vao.turno.id, turnoNome: vao.turno.nome, participanteId: pessoa, horaInicio: vao.horaInicio, horaFim: vao.horaFim });
  };

  const mirar = (evento: MouseEvent<HTMLElement>, pessoa: string | null, dia: string) => {
    if (sessao) return;
    const rect = evento.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const bruto = minutoNaPosicao((evento.clientX - rect.left) / rect.width, janela);
    const minuto = Math.min(Math.floor(bruto / PASSO_MINUTOS) * PASSO_MINUTOS, janela.fim - PASSO_MINUTOS);
    if (mira?.pessoa !== pessoa || mira.dia !== dia || mira.minuto !== minuto) setMira({ pessoa, dia, minuto });
  };

  // Numa coluna só não há o que crescer
  const colunas = colunasDaGrade(dias.length, dias.length > 1 ? foco : null);
  const transicaoColunas = 'transition-[grid-template-columns] duration-[180ms] ease-out';
  const arrastavel = (a: AtribuicaoResumo) => podeArrastar && a.situacao === 'planejada' && a.semanaSituacao === 'aberta';
  const linhas = grade.map((linha) => {
    const chave = linha.pessoa?.id ?? null;
    return { linha, chave, porDia: dias.map((dia) => agruparPorTarefa(trechosDe(chave, dia, linha.porDia[dia] ?? []))) };
  });

  return (
    <div className={`animate-surgir ${className}`}>
      <div ref={gradeRef} className="overflow-x-auto rounded-lg border border-line bg-white">
        <div className="min-w-[56rem]" onPointerLeave={() => apontar(null)}>
          {/* Cabeçalho: o dia e as horas, todas no dia em foco */}
          <div className="flex items-end border-b border-line">
            <span className={`${LARGURA_NOME} shrink-0`} />
            <div className={`grid flex-1 ${transicaoColunas}`} style={{ gridTemplateColumns: colunas }}>
              {dias.map((dia, indice) => (
                <div
                  key={dia}
                  onPointerEnter={() => apontar(indice)}
                  className={`border-l border-line px-0.5 pt-2 ${dia === hoje ? 'bg-brand-light/40' : ''}`}
                >
                  <Link
                    href={`/producao?dia=${dia}`}
                    className={`flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide uppercase underline-offset-2 hover:underline ${
                      dia === hoje ? 'text-brand-dark' : dia < hoje ? 'text-muted/70' : 'text-muted'
                    }`}
                  >
                    {dia === hoje && <span aria-label="hoje" className="h-1.5 w-1.5 rounded-full bg-brand" />}
                    {siglaDia(dia)} {dia.slice(8)}
                  </Link>
                  <div className="relative mt-1">
                    <ReguaDeHoras janela={janela} todas={zoom !== 'semana' || indice === foco} />
                    <DivisorAlmoco janela={janela} />
                    {dia === hoje && <LinhaAgora janela={janela} ponto />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {linhas.map(({ linha, chave, porDia }) => {
            const pessoa = linha.pessoa;
            const semTarefa = pessoa && porDia.every((barras) => barras.length === 0);
            return (
              <div key={chave ?? 'sem-ninguem'} className="flex items-stretch border-b border-line last:border-b-0">
                <div className={`${LARGURA_NOME} flex shrink-0 flex-col justify-center px-3 py-1`}>
                  <span className={`truncate text-sm font-semibold ${pessoa ? 'text-ink' : 'text-atencao'}`}>{pessoa?.nome ?? 'Sem ninguém'}</span>
                  {semTarefa && <span className="text-xs text-atencao">Sem tarefa na semana</span>}
                </div>
                <div
                  {...{ [ATRIBUTO_LINHA]: chave ?? '' }}
                  className={`grid flex-1 ${transicaoColunas}`}
                  style={{ gridTemplateColumns: colunas, height: ALTURA_LINHA }}
                >
                  {dias.map((dia, indice) => {
                    const doDia = linha.porDia[dia] ?? [];
                    const barras = porDia[indice];
                    const sombra =
                      sessao?.modo === 'mover' && emArrasto && dia === sessao.diaOriginal && chave === sessao.pessoaOriginal ? sessao.faixaOriginal : null;
                    const miraAqui = mira && mira.pessoa === chave && mira.dia === dia ? mira.minuto : null;
                    return (
                      <div
                        key={dia}
                        {...{ [ATRIBUTO_DIA]: dia }}
                        aria-label={nomeDia(dia)}
                        onPointerEnter={() => apontar(indice)}
                        className={`relative border-l border-line ${
                          dia === hoje ? 'bg-brand-light/25' : indice === foco ? 'bg-surface/70' : dia < hoje ? 'bg-surface/40' : ''
                        }`}
                      >
                        <MarcasDeHora janela={janela} />
                        <DivisorAlmoco janela={janela} />
                        {opcoes && (
                          <button
                            type="button"
                            onClick={(evento) => lancarEm(evento, chave, dia, doDia)}
                            onPointerMove={(evento) => mirar(evento, chave, dia)}
                            onPointerLeave={() => setMira(null)}
                            aria-label={`Lançar tarefa: ${pessoa?.nome ?? 'sem ninguém'}, ${nomeDia(dia)}`}
                            className="absolute inset-0 cursor-copy focus-visible:bg-brand-light/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-dark"
                          />
                        )}
                        {miraAqui !== null && !sessao && <Mira minuto={miraAqui} janela={janela} />}
                        {sombra && emArrasto && <SombraOriginal faixa={sombra} janela={janela} categoria={emArrasto.categoria} />}
                        {barras.map((barra) => {
                          const ehSessao = sessao?.id === barra.item.id && sessao.pessoa === chave && sessao.dia === dia;
                          return (
                            <BarraTarefa
                              key={barra.item.id}
                              atribuicao={barra.item}
                              alvo={{ id: barra.item.id, dia, faixa: barra.completa, pessoa: chave }}
                              desenho={barra.faixa}
                              perfil={barra.perfil}
                              janela={janela}
                              livreDepois={livreDepois(barra, barras, janela)}
                              encosta={encostas(barra, barras)}
                              arrastavel={arrastavel(barra.item)}
                              promovivel={podeArrastar && barra.item.semanaSituacao === 'aberta'}
                              emArrasto={ehSessao}
                              destino={ehSessao && sessao.pessoa !== sessao.pessoaOriginal ? nomeDe(sessao.pessoa) : null}
                              onPromover={promover}
                              iniciar={iniciar}
                              aoTeclar={aoTeclar}
                            />
                          );
                        })}
                        {dia === hoje && <LinhaAgora janela={janela} />}
                        {pessoa && <Ocupacao minutos={ocupacaoDoDia(doDia.map(faixaDe), janela)} jornada={jornada} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {sessao ? intervalo(sessao.faixa) : anuncio}
      </p>

      {ponto && opcoes && <NovaTarefaModal semana={semana} opcoes={opcoes} ponto={ponto} onFechar={() => setPonto(null)} />}

      <ToastDesfazer aviso={aviso} onFechar={fecharAviso} duracaoMs={5000} />
    </div>
  );
}

/** Dois degraus que dividem alguma altura da linha. */
function mesmaAltura(um: Degrau<unknown>, outro: Degrau<unknown>): boolean {
  const a = faixaVertical(um.camada, um.camadas);
  const b = faixaVertical(outro.camada, outro.camadas);
  return a.topo < b.topo + b.altura && b.topo < a.topo + a.altura;
}

/**
 * Os lados em que a barra encosta em outra na mesma altura: a que termina às
 * 9h45 e a que começa às 9h45 se tocam, sem o recuo que sugere um vão de tempo.
 */
function encostas(barra: Barra<unknown>, todas: readonly Barra<unknown>[]): { inicio: boolean; fim: boolean } {
  const primeiro = barra.perfil[0];
  const ultimo = barra.perfil[barra.perfil.length - 1];
  const outras = todas.filter((outra) => outra !== barra);
  return {
    inicio: outras.some((outra) => {
      const fim = outra.perfil[outra.perfil.length - 1];
      return fim.fim === primeiro.inicio && mesmaAltura(fim, primeiro);
    }),
    fim: outras.some((outra) => outra.perfil[0].inicio === ultimo.fim && mesmaAltura(outra.perfil[0], ultimo)),
  };
}

/** Os minutos de eixo livres à direita da barra, até a próxima que começa ou o fim do dia. */
function livreDepois(barra: Barra<unknown>, todas: readonly Barra<unknown>[], janela: Eixo): number {
  const proximo = todas.reduce((menor, b) => (b.faixa.inicio >= barra.faixa.fim ? Math.min(menor, b.faixa.inicio) : menor), janela.fim);
  return duracaoUtil({ inicio: barra.faixa.fim, fim: proximo }, janela);
}

/** O almoço: um divisor fino entre manhã e tarde, no lugar da largura que ele ocupava. */
function DivisorAlmoco({ janela }: { janela: Eixo }) {
  return (
    <>
      {(janela.vaos ?? []).map((vao) => (
        <span
          key={vao.inicio}
          aria-hidden
          title={`Intervalo ${formatMinuto(vao.inicio)}–${formatMinuto(vao.fim)}`}
          style={{ left: `${percentualDoMinuto(vao.inicio, janela)}%` }}
          className="pointer-events-none absolute inset-y-0 w-[5px] -translate-x-1/2 bg-line"
        />
      ))}
    </>
  );
}

/**
 * Os números das horas no cabeçalho do dia: as pares, ou todas no dia em foco. A
 * primeira e a última ancoram na borda, e as do divisor ficam cada uma do seu lado.
 */
function ReguaDeHoras({ janela, todas }: { janela: Eixo; todas: boolean }) {
  const marcas = marcasDeHora(janela, { pares: !todas });
  const vaos = janela.vaos ?? [];
  return (
    <div className="relative h-3.5 text-[10px] leading-3 text-muted">
      {marcas.map((minuto) => {
        const esquerda = percentualDoMinuto(minuto, janela);
        const ancora =
          esquerda <= 0 || vaos.some((vao) => vao.fim === minuto)
            ? 'pl-1'
            : esquerda >= 100 || vaos.some((vao) => vao.inicio === minuto)
              ? '-translate-x-full pr-1'
              : '-translate-x-1/2';
        return (
          <span key={minuto} aria-hidden style={{ left: `${esquerda}%` }} className={`absolute tabular-nums ${ancora}`}>
            {Math.floor(minuto / 60)}
          </span>
        );
      })}
    </div>
  );
}

/** As linhas de hora em hora, bem claras e sem número: o número fica no cabeçalho. */
function MarcasDeHora({ janela }: { janela: Eixo }) {
  const bordas = new Set((janela.vaos ?? []).flatMap((vao) => [vao.inicio, vao.fim]));
  return (
    <>
      {marcasDeHora(janela).map((minuto) => {
        const esquerda = percentualDoMinuto(minuto, janela);
        // A marca da ponta cairia em cima da borda do dia, e a do vão em cima do divisor
        if (esquerda <= 0 || esquerda >= 100 || bordas.has(minuto)) return null;
        return <div key={minuto} aria-hidden style={{ left: `${esquerda}%` }} className="pointer-events-none absolute inset-y-0 w-px bg-line/50" />;
      })}
    </>
  );
}

/** A faixa de quinze minutos sob o mouse no vazio, com o "+" de que ali se lança. */
function Mira({ minuto, janela }: { minuto: number; janela: Eixo }) {
  const { left, width } = posicaoPercentual({ inicio: minuto, fim: minuto + PASSO_MINUTOS, derivada: false }, janela);
  return (
    <span
      aria-hidden
      style={{ left: `${left}%`, width: `${width}%` }}
      className="pointer-events-none absolute inset-y-0 flex items-center justify-center bg-brand-light/60 text-sm leading-none text-brand-dark"
    >
      +
    </span>
  );
}

/** Onde a tarefa estava antes do arrasto: apagada, para o olho medir quanto ela andou. */
function SombraOriginal({ faixa, janela, categoria }: { faixa: Faixa; janela: Eixo; categoria: AtribuicaoResumo['categoria'] }) {
  const { left, width } = posicaoPercentual(faixa, janela);
  return (
    <span aria-hidden style={{ left: `${left}%`, width: `${width}%` }} className="pointer-events-none absolute inset-y-0 p-0.5 opacity-40">
      <span className="relative block h-full overflow-hidden rounded-md border border-line bg-white">
        <span className={`absolute inset-y-0 left-0 w-1 ${COR_CATEGORIA[categoria]}`} />
      </span>
    </span>
  );
}

/**
 * Quanto da jornada a pessoa tem no dia: uma linha de 3px no pé da célula,
 * cinza até a jornada e em alerta quando passa dela.
 */
function Ocupacao({ minutos, jornada }: { minutos: number; jornada: number }) {
  if (minutos === 0 || jornada === 0) return null;
  const fracao = minutos / jornada;
  return (
    <span
      title={`${formatDuracao(minutos)} / ${formatDuracao(jornada)}`}
      role="img"
      aria-label={`Ocupação: ${formatDuracao(minutos)} de ${formatDuracao(jornada)}`}
      className="absolute inset-x-0 bottom-0 z-[11] h-[3px]"
    >
      <span style={{ width: `${Math.min(fracao, 1) * 100}%` }} className={`block h-full ${fracao > 1 ? 'bg-atencao' : 'bg-gray-300'}`} />
    </span>
  );
}
