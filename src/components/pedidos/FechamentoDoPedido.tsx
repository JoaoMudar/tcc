'use client';

import { Button } from '@/components/ui/Button';
import { CampoEndereco } from '@/components/ui/CampoEndereco';
import { ORIGENS_FRETE, type OrigemFrete, formatPesoCarga } from '@/lib/frete';
import { formatMoeda, formatTotal } from '@/lib/pedidos-rotulos';
import type { SugestaoDeEndereco } from '@/lib/rotas';

interface FechamentoDoPedidoProps {
  /** Soma dos itens, em centavos. Nula enquanto falta preço ou quantidade. */
  subtotalCentavos: number | null;
  /** O frete digitado, em centavos. Nulo é "sem frete". */
  freteCentavos: number | null;
  peso: { kg: number; semPeso: number };
  /** Presente só na negociação: sem ele o frete é só leitura. */
  edicao?: {
    freteTexto: string;
    origem: OrigemFrete;
    /** "≈ 84 km, ida e volta", depois de uma sugestão. */
    distancia: string | null;
    sugerindo: boolean;
    aviso: string | null;
    onAlterarFrete: (texto: string) => void;
    onAlterarOrigem: (origem: OrigemFrete) => void;
    /** O endereço de saída na origem `outro`. */
    endereco: string;
    onAlterarEndereco: (texto: string, ponto: { lat: number; lng: number } | null) => void;
    buscar: (texto: string) => Promise<SugestaoDeEndereco[]>;
    onSugerir: () => void;
    /** Sem endereço de entrega, ou não achado no mapa: o botão de completá-lo, no lugar do aviso. */
    falta?: { endereco: string | null; onAbrir: () => void } | null;
  };
}

/**
 * P17, RF-67: a linha final do pedido. A soma das mudas, o frete, o total e o
 * peso estimado da carga, que é o que o cliente pergunta quando fecha o preço.
 *
 * O frete se sugere pela distância (RN-64), mas **o campo é da chefia**: ela
 * digita o que negociou, mesmo que destoe da conta. O peso é estimado pelo
 * recipiente cheio (RN-65), e diz quantos itens ficaram de fora da conta.
 */
export function FechamentoDoPedido({ subtotalCentavos, freteCentavos, peso, edicao }: FechamentoDoPedidoProps) {
  const total = subtotalCentavos === null ? null : subtotalCentavos + (freteCentavos ?? 0);
  const itensSemPeso = peso.semPeso === 1 ? '1 item sem peso' : `${peso.semPeso} itens sem peso`;

  return (
    <section aria-label="Fechamento do pedido" className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      <dl className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 text-base">
        <dt className="text-muted">Mudas</dt>
        <dd className="text-right text-ink">{formatTotal(subtotalCentavos)}</dd>

        <dt className="text-muted">Frete</dt>
        <dd className="text-right text-ink">
          {edicao ? (
            <label className="flex h-11 w-36 items-center gap-2 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 focus-within:border-brand-dark">
              <span className="text-sm text-muted">R$</span>
              <input
                aria-label="Frete"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={edicao.freteTexto}
                onChange={(evento) => edicao.onAlterarFrete(evento.target.value)}
                className="min-w-0 flex-1 bg-transparent text-right text-base text-ink outline-none"
              />
            </label>
          ) : freteCentavos === null ? (
            'sem frete'
          ) : (
            formatMoeda(freteCentavos)
          )}
        </dd>

        <dt className="font-bold text-ink">Total</dt>
        <dd className="text-right text-lg font-bold text-ink">{formatTotal(total)}</dd>

        <dt className="text-muted">Peso estimado</dt>
        <dd className="text-right text-ink">
          {peso.kg > 0 ? formatPesoCarga(peso.kg) : '-'}
          {peso.semPeso > 0 && <span className="block text-xs text-amber-800">{itensSemPeso}</span>}
        </dd>
      </dl>

      {edicao && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted">Sugerir frete saindo de</span>
              <div role="radiogroup" aria-label="Saída do frete" className="flex gap-1 rounded-xl bg-gray-100 p-1">
                {(Object.keys(ORIGENS_FRETE) as OrigemFrete[]).map((origem) => (
                  <label
                    key={origem}
                    className="flex min-h-9 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-gray-700 has-checked:bg-white has-checked:text-brand-dark has-checked:shadow-sm"
                  >
                    <input
                      type="radio"
                      name="frete_origem"
                      value={origem}
                      checked={edicao.origem === origem}
                      onChange={() => edicao.onAlterarOrigem(origem)}
                      className="sr-only"
                    />
                    {ORIGENS_FRETE[origem]}
                  </label>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              className="md:w-auto!"
              onClick={edicao.onSugerir}
              pending={edicao.sugerindo}
              pendingLabel="Calculando…"
            >
              Sugerir frete pela distância
            </Button>
          </div>
          {edicao.origem === 'outro' && (
            <CampoEndereco
              label="Endereço de saída"
              name="frete_origem_endereco"
              defaultValue={edicao.endereco}
              buscar={edicao.buscar}
              onAlterar={edicao.onAlterarEndereco}
            />
          )}
          {edicao.distancia && <p className="text-sm text-muted">{edicao.distancia}</p>}
          <p className="text-sm font-semibold text-amber-900 empty:hidden" aria-live="polite">
            {edicao.aviso}
          </p>
          {edicao.falta && (
            <button
              type="button"
              onClick={edicao.falta.onAbrir}
              className="flex min-h-11 items-center self-start rounded-lg border-[1.5px] border-amber-600 bg-amber-50 px-3 text-sm font-bold text-amber-900 active:bg-amber-100"
            >
              {edicao.falta.endereco ? 'Corrigir endereço' : 'Adicionar endereço'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
