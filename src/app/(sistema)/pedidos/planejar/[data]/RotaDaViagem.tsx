'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useActionState, useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { CampoEndereco } from '@/components/ui/CampoEndereco';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE, type FormState } from '@/lib/form-state';
import { linkGoogleMaps, moverNaLista } from '@/lib/rotas';
import {
  adicionarParadaAction,
  buscarEnderecosAction,
  definirPartidaAction,
  iniciarCarregamentoAction,
  removerParadaAction,
  salvarOrdemAction,
  sugerirOrdemAction,
} from './actions';

export interface ParadaNaRota {
  id: string;
  pedidoId: string | null;
  numero: number | null;
  cliente: string | null;
  cidade: string | null;
  descricao: string | null;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  naoAchado: boolean;
}

export type EscolhaDePartida = 'agrolandia' | 'itapema' | 'outro';

interface RotaDaViagemProps {
  data: string;
  viagemId: string;
  partida: { descricao: string; lat: number | null; lng: number | null; escolha: EscolhaDePartida };
  paradas: readonly ParadaNaRota[];
  /** `cerca de 42 km · 1 h 05 min`, quando a API respondeu para esta ordem. */
  distancia: string | null;
  aviso: string | null;
}

const PARTIDAS: { escolha: EscolhaDePartida; nome: string }[] = [
  { escolha: 'agrolandia', nome: 'Agrolândia' },
  { escolha: 'itapema', nome: 'Itapema' },
  { escolha: 'outro', nome: 'Outro' },
];

function Seta({ para }: { para: 'cima' | 'baixo' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d={para === 'cima' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface CartaoProps {
  parada: ParadaNaRota;
  marca: string;
  primeiro: boolean;
  ultimo: boolean;
  onMover: (sentido: -1 | 1) => void;
  remover: (formData: FormData) => void;
  data: string;
  viagemId: string;
}

function CartaoDaParada({ parada, marca, primeiro, ultimo, onMover, remover, data, viagemId }: CartaoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: parada.id });
  const entrega = parada.pedidoId !== null;
  const aviso = !entrega
    ? null
    : !parada.endereco
      ? 'Sem endereço de entrega.'
      : parada.naoAchado
        ? 'Endereço não achado no mapa.'
        : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex touch-manipulation items-center gap-2.5 rounded-lg border p-2.5 pl-3 ${isDragging ? 'z-10 border-2 border-dashed border-brand bg-brand-light shadow-lg' : entrega ? 'border-line bg-white' : 'border-line bg-stone-50'}`}
      {...attributes}
      {...listeners}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${entrega ? 'bg-brand text-white' : 'bg-gray-200 text-ink'}`}
      >
        {marca}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-bold text-ink">{entrega ? parada.cliente : parada.descricao}</span>
        <span className="text-sm text-muted">
          {entrega
            ? [parada.cidade, `pedido ${parada.numero}`].filter(Boolean).join(' · ')
            : ['Parada extra', parada.endereco].filter(Boolean).join(' · ')}
        </span>
        {aviso && <span className="text-sm font-semibold text-amber-800">{aviso}</span>}
      </span>
      {!entrega && (
        <form action={remover}>
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="viagem_id" value={viagemId} />
          <input type="hidden" name="parada_id" value={parada.id} />
          <button
            type="submit"
            aria-label="Tirar parada"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-muted"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </form>
      )}
      <span className="flex flex-col gap-0.5">
        <button
          type="button"
          aria-label="Subir"
          disabled={primeiro}
          onClick={() => onMover(-1)}
          className="flex h-8 w-9 items-center justify-center rounded-md border border-line bg-white text-ink disabled:opacity-40"
        >
          <Seta para="cima" />
        </button>
        <button
          type="button"
          aria-label="Descer"
          disabled={ultimo}
          onClick={() => onMover(1)}
          className="flex h-8 w-9 items-center justify-center rounded-md border border-line bg-white text-ink disabled:opacity-40"
        >
          <Seta para="baixo" />
        </button>
      </span>
    </li>
  );
}

/**
 * Tela 2: a rota. A ordem vem sugerida pela API, e a pessoa a arruma
 * pressionando e arrastando, ou pelas setas, para quem não acerta o arraste.
 * Cada mudança grava ao soltar.
 */
export function RotaDaViagem({ data, viagemId, partida, paradas, distancia, aviso }: RotaDaViagemProps) {
  const [ordem, setOrdem] = useState(() => paradas.map((parada) => parada.id));
  const [erroDaOrdem, setErroDaOrdem] = useState<string | null>(null);
  const [gravando, startTransition] = useTransition();
  const [outro, setOutro] = useState(partida.escolha === 'outro');

  const [saida, escolherSaida, escolhendo] = useActionState(definirPartidaAction, EMPTY_FORM_STATE);
  const [sugestao, sugerir, sugerindo] = useActionState(sugerirOrdemAction, EMPTY_FORM_STATE);
  // A contagem das paradas que entraram: o campo de endereço guarda o próprio
  // texto, e só esvazia ao nascer de novo
  const [extra, adicionarParada, adicionando] = useActionState(
    async (anterior: FormState & { entraram?: number }, formData: FormData) => {
      const resultado = await adicionarParadaAction(anterior, formData);
      return { ...resultado, entraram: (anterior.entraram ?? 0) + (resultado.error ? 0 : 1) };
    },
    EMPTY_FORM_STATE as FormState & { entraram?: number },
  );
  const [remocao, removerParada] = useActionState(removerParadaAction, EMPTY_FORM_STATE);
  const [inicio, iniciar, iniciando] = useActionState(iniciarCarregamentoAction, EMPTY_FORM_STATE);

  // Mouse e toque separados: no toque, só pressionar e segurar vira arraste, e
  // rolar a lista com o dedo continua rolando
  // O dnd-kit numera os ids por contador global, que difere entre servidor e
  // navegador: com o id fixo, a hidratação não reclama do aria-describedby
  const dndId = useId();
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const porId = new Map(paradas.map((parada) => [parada.id, parada]));
  const naOrdem = ordem.map((id) => porId.get(id)).filter((parada): parada is ParadaNaRota => parada !== undefined);

  function gravar(nova: string[]) {
    const anterior = ordem;
    setOrdem(nova);
    setErroDaOrdem(null);
    startTransition(async () => {
      const resultado = await salvarOrdemAction(data, viagemId, nova);
      if (resultado.error) {
        setOrdem(anterior);
        setErroDaOrdem(resultado.error);
      }
    });
  }

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    gravar(moverNaLista(ordem, ordem.indexOf(String(active.id)), ordem.indexOf(String(over.id))));
  }

  const links = linkGoogleMaps(
    { lat: partida.lat, lng: partida.lng, endereco: partida.descricao },
    naOrdem.map((parada) => ({ lat: parada.lat, lng: parada.lng, endereco: parada.endereco })),
  );

  let entregas = 0;
  const erro = erroDaOrdem ?? saida.error ?? sugestao.error ?? remocao.error ?? inicio.error;

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        {aviso && <Notice tone="warning">{aviso}</Notice>}
        {erro && <Notice tone="error">{erro}</Notice>}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Saída</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {PARTIDAS.map(({ escolha, nome }) => {
              const ativa = outro ? escolha === 'outro' : partida.escolha === escolha;
              const estilo = `min-h-11 w-full rounded-lg border text-base font-bold ${ativa ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white text-ink'}`;
              return escolha === 'outro' ? (
                <button key={escolha} type="button" aria-pressed={ativa} className={estilo} onClick={() => setOutro(true)}>
                  {nome}
                </button>
              ) : (
                <form key={escolha} action={escolherSaida} onSubmit={() => setOutro(false)}>
                  <input type="hidden" name="data" value={data} />
                  <input type="hidden" name="viagem_id" value={viagemId} />
                  <input type="hidden" name="partida" value={escolha} />
                  <button type="submit" aria-pressed={ativa} disabled={escolhendo} className={estilo}>
                    {nome}
                  </button>
                </form>
              );
            })}
          </div>
          {outro && (
            <form action={escolherSaida} className="flex items-end gap-2">
              <input type="hidden" name="data" value={data} />
              <input type="hidden" name="viagem_id" value={viagemId} />
              <input type="hidden" name="partida" value="outro" />
              <CampoEndereco
                label="Endereço de saída"
                name="endereco"
                className="flex-1"
                required
                defaultValue={saida.fields?.endereco ?? (partida.escolha === 'outro' ? partida.descricao : '')}
                buscar={buscarEnderecosAction}
              />
              <Button type="submit" className="w-auto!" pending={escolhendo} pendingLabel="…">
                Usar
              </Button>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Ordem das entregas</h2>
            {distancia && <span className="text-sm font-bold text-brand-dark">{distancia}</span>}
          </div>

          <div className="flex items-center gap-2.5 rounded-lg bg-stone-100 px-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M3 11l9-7 9 7v9H3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-base font-semibold text-ink">{partida.descricao}</span>
          </div>

          <DndContext id={dndId} sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
              <ol className="flex flex-col gap-2" aria-busy={gravando || undefined}>
                {naOrdem.map((parada, indice) => {
                  const marca = parada.pedidoId ? String(++entregas) : 'P';
                  return (
                    <CartaoDaParada
                      key={parada.id}
                      parada={parada}
                      marca={marca}
                      primeiro={indice === 0}
                      ultimo={indice === naOrdem.length - 1}
                      onMover={(sentido) => gravar(moverNaLista(ordem, indice, indice + sentido))}
                      remover={removerParada}
                      data={data}
                      viagemId={viagemId}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>

          <div className="grid grid-cols-2 gap-2">
            <form action={sugerir}>
              <input type="hidden" name="data" value={data} />
              <input type="hidden" name="viagem_id" value={viagemId} />
              <Button type="submit" variant="outline" pending={sugerindo} pendingLabel="Calculando…">
                Sugerir ordem
              </Button>
            </form>
            {links.length > 0 ? (
              <a
                href={links[0]}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-touch items-center justify-center rounded-xl bg-brand px-3 text-base font-bold text-white active:bg-brand-dark"
              >
                Google Maps
              </a>
            ) : (
              <span />
            )}
          </div>
          {links.slice(1).map((link, indice) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-touch items-center justify-center rounded-xl border-2 border-brand bg-white px-3 text-base font-bold text-brand"
            >
              Continuar no Maps{links.length > 2 ? ` (${indice + 2})` : ''}
            </a>
          ))}
        </section>

        <form action={adicionarParada} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="viagem_id" value={viagemId} />
          <TextField label="Parada extra" name="descricao" required defaultValue={extra.fields?.descricao} />
          <CampoEndereco key={extra.entraram ?? 0} label="Endereço" name="endereco" buscar={buscarEnderecosAction} />
          {extra.error && <Notice tone="error">{extra.error}</Notice>}
          <Button type="submit" variant="secondary" pending={adicionando} pendingLabel="Adicionando…">
            Adicionar parada
          </Button>
        </form>
      </div>

      <div className="border-t border-line bg-white px-4 pt-3 pb-5">
        <form action={iniciar}>
          <input type="hidden" name="data" value={data} />
          <input type="hidden" name="viagem_id" value={viagemId} />
          <Button type="submit" pending={iniciando} pendingLabel="Criando as cargas…">
            Iniciar carregamento
          </Button>
        </form>
      </div>
    </>
  );
}
