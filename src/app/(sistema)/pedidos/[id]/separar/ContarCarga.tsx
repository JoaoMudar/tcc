'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { formatAltura } from '@/lib/pedidos-rotulos';
import { concluirCargaAction, marcarItemSeparadoAction } from './actions';

export interface CargaParaContar {
  id: string;
  numero: number;
  situacao: 'pendente' | 'pronto';
  itens: readonly {
    id: string;
    especie: string;
    recipiente: string;
    alturaM: number | null;
    quantidade: number;
    separado: boolean;
  }[];
}

interface ContarCargaProps {
  pedidoId: string;
  cargas: readonly CargaParaContar[];
}

/**
 * T8.14, passo 2: contar e marcar, carga por carga.
 *
 * **O que se grava é a confirmação, e não o número contado**: quantas contar já
 * está escrito na linha, e guardar um segundo número abriria a pergunta do que
 * fazer quando os dois divergem, que hoje se resolve a chefia editando o pedido.
 */
export function ContarCarga({ pedidoId, cargas }: ContarCargaProps) {
  const [marcacao, marcar, marcando] = useActionState(marcarItemSeparadoAction, EMPTY_FORM_STATE);
  const [conclusao, concluir, concluindo] = useActionState(concluirCargaAction, EMPTY_FORM_STATE);

  const primeiraPendente = cargas.findIndex((carga) => carga.situacao !== 'pronto');
  const [aba, setAba] = useState(primeiraPendente === -1 ? 0 : primeiraPendente);
  const atual = cargas[aba] ?? cargas[0];
  if (!atual) return null;

  const separados = atual.itens.filter((item) => item.separado).length;
  const completa = separados === atual.itens.length;

  return (
    <div className="flex flex-col gap-4">
      {cargas.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {cargas.map((carga, indice) => (
            <Button
              key={carga.id}
              variant={indice === aba ? 'primary' : 'secondary'}
              onClick={() => setAba(indice)}
            >
              Carga {carga.numero} ({carga.itens.filter((i) => i.separado).length}/{carga.itens.length})
            </Button>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
        <p className="text-base font-semibold text-ink">
          Separados: {separados} de {atual.itens.length}
        </p>
        <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
          <div
            className="h-full bg-brand"
            style={{ width: atual.itens.length ? `${(separados / atual.itens.length) * 100}%` : '0%' }}
          />
        </div>
        {atual.situacao === 'pronto' && <Notice tone="success">Esta carga já está pronta.</Notice>}
      </section>

      {marcacao.error && <Notice tone="error">{marcacao.error}</Notice>}

      <ul className="flex flex-col gap-3">
        {atual.itens.map((item) => (
          <li
            key={item.id}
            className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${item.separado ? 'border-green-600 bg-green-50' : 'border-line bg-white'}`}
          >
            <div>
              <p className="text-base font-bold text-ink">{item.especie}</p>
              <p className="text-sm text-muted">
                {item.recipiente}
                {item.alturaM ? ` · ${formatAltura(item.alturaM)}` : ''} · {formatQuantidade(item.quantidade)}
              </p>
            </div>
            {atual.situacao !== 'pronto' && (
              <form action={marcar}>
                <input type="hidden" name="pedido_id" value={pedidoId} />
                <input type="hidden" name="carga_item_id" value={item.id} />
                {/* Grava o valor final, e não inverte o atual: o toque repetido
                    pela conexão ruim do galpão chega ao mesmo resultado */}
                <input type="hidden" name="separado" value={item.separado ? 'nao' : 'sim'} />
                <Button
                  type="submit"
                  variant={item.separado ? 'outline' : 'primary'}
                  pending={marcando}
                  pendingLabel="…"
                >
                  {item.separado ? '✓ Separado (tocar para desfazer)' : 'Separar'}
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {conclusao.error && <Notice tone="error">{conclusao.error}</Notice>}
      {conclusao.success && <Notice tone="success">{conclusao.success}</Notice>}

      {atual.situacao !== 'pronto' &&
        (completa ? (
          <form action={concluir} className="flex flex-col gap-2">
            <input type="hidden" name="pedido_id" value={pedidoId} />
            <input type="hidden" name="carga_id" value={atual.id} />
            <Button type="submit" pending={concluindo} pendingLabel="Fechando…">
              Carga {atual.numero} pronta
            </Button>
          </form>
        ) : (
          <Notice tone="info">Marque todos os itens desta carga para poder fechá-la.</Notice>
        ))}
    </div>
  );
}
