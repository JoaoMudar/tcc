import { formatQuantidade } from './lotes-rotulos';
import { formatAltura } from './pedidos-rotulos';

/**
 * RF-24: de que lote sai a muda vendida. A sugestão é pura para ser testada sem
 * banco; quem a grava é `cargas.ts`, e quem a troca é a pessoa no pátio.
 */

export interface LoteCandidato {
  id: string;
  codigo: string;
  especieId: string;
  recipienteId: string;
  saldo: number;
  alturaM: number | null;
  /** `AAAA-MM-DD`: o mais antigo sai primeiro, à igualdade de altura. */
  dataCriacao: string;
}

export interface ItemParaSugerir {
  especieId: string | null;
  recipienteId: string;
  alturaM: number | null;
  quantidade: number;
}

/** Distância da altura pedida; lote sem medida fica atrás de qualquer medido, quando o item pede altura. */
function distancia(lote: LoteCandidato, item: ItemParaSugerir): number {
  if (item.alturaM === null) return 0;
  if (lote.alturaM === null) return Number.POSITIVE_INFINITY;
  return Math.abs(lote.alturaM - item.alturaM);
}

/**
 * Mesma espécie e recipiente, com saldo. **Primeiro o que cobre a quantidade
 * inteira**, porque um lote só por item de carga é a regra (migration
 * `20261027000002`); entre eles, a altura mais próxima da pedida, e depois o
 * mais antigo. Sem lote que cubra, o mesmo critério entre os que têm saldo: a
 * conclusão da viagem é que recusa a baixa maior que o saldo.
 */
export function sugerirLote(lotes: readonly LoteCandidato[], item: ItemParaSugerir): string | null {
  if (!item.especieId) return null;
  const doPar = lotes.filter((l) => l.especieId === item.especieId && l.recipienteId === item.recipienteId && l.saldo > 0);
  if (doPar.length === 0) return null;
  const cobrem = doPar.filter((l) => l.saldo >= item.quantidade);
  const ordenados = [...(cobrem.length > 0 ? cobrem : doPar)].sort(
    (a, b) => distancia(a, item) - distancia(b, item) || a.dataCriacao.localeCompare(b.dataCriacao) || b.saldo - a.saldo,
  );
  return ordenados[0].id;
}

/** Os lotes que a tela oferece para um item: os do mesmo par de espécie e recipiente. */
export function lotesDoItem(
  lotes: readonly LoteCandidato[],
  item: Pick<ItemParaSugerir, 'especieId' | 'recipienteId'>,
): LoteCandidato[] {
  return lotes.filter((l) => l.especieId === item.especieId && l.recipienteId === item.recipienteId);
}

/** As opções da escolha do lote na tela: código, saldo e altura, que é o que se confere no canteiro. */
export function opcoesDeLote(
  lotes: readonly LoteCandidato[],
  item: Pick<ItemParaSugerir, 'especieId' | 'recipienteId'>,
): { value: string; label: string }[] {
  return lotesDoItem(lotes, item).map((l) => ({
    value: l.id,
    label: [l.codigo, `${formatQuantidade(l.saldo)} mudas`, l.alturaM === null ? null : formatAltura(l.alturaM)]
      .filter(Boolean)
      .join(' · '),
  }));
}
