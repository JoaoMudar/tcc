'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { criarCargaUnicaAction, criarCargasAction } from './actions';

export interface ItemParaOrganizar {
  id: string;
  especie: string;
  recipiente: string;
  quantidade: number;
}

interface OrganizarCargasProps {
  pedidoId: string;
  itens: readonly ItemParaOrganizar[];
}

/**
 * T8.14, passo 1: quantas viagens. A pergunta é do caminhão, não do sistema, e
 * por isso a resposta mais comum tem um botão só.
 *
 * **O confirmar só habilita quando todo item fecha.** Descobrir no envio que
 * faltaram 50 mudas faria a pessoa refazer a grade inteira; o painel embaixo de
 * cada item mostra a conta enquanto ela digita.
 */
export function OrganizarCargas({ pedidoId, itens }: OrganizarCargasProps) {
  const [unica, criarUnica, criandoUnica] = useActionState(criarCargaUnicaAction, EMPTY_FORM_STATE);
  const [divisao, dividir, dividindo] = useActionState(criarCargasAction, EMPTY_FORM_STATE);

  const [dividindoAberto, setDividindoAberto] = useState(false);
  // Começa com duas: a primeira com tudo, a segunda zerada, que é como se divide
  const [cargas, setCargas] = useState<Record<string, string>[]>(() => [
    Object.fromEntries(itens.map((item) => [item.id, String(item.quantidade)])),
    Object.fromEntries(itens.map((item) => [item.id, '0'])),
  ]);

  const alterar = (indice: number, itemId: string, valor: string) =>
    setCargas((atuais) => atuais.map((carga, i) => (i === indice ? { ...carga, [itemId]: valor } : carga)));

  const somaDe = (itemId: string) =>
    cargas.reduce((total, carga) => total + (lerQuantidade(carga[itemId] ?? '') ?? 0), 0);
  const tudoFecha = itens.every((item) => somaDe(item.id) === item.quantidade);

  if (!dividindoAberto) {
    return (
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {itens.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-white p-4">
              <p className="text-base font-semibold text-ink">{item.especie}</p>
              <p className="text-sm text-muted">
                {item.recipiente} · {formatQuantidade(item.quantidade)}
              </p>
            </li>
          ))}
        </ul>

        {unica.error && <Notice tone="error">{unica.error}</Notice>}
        <form action={criarUnica} className="flex flex-col gap-2">
          <input type="hidden" name="pedido_id" value={pedidoId} />
          <Button type="submit" pending={criandoUnica} pendingLabel="Organizando…">
            Cabe em uma viagem
          </Button>
        </form>
        <Button variant="outline" onClick={() => setDividindoAberto(true)}>
          Dividir em mais de uma viagem
        </Button>
      </div>
    );
  }

  return (
    <form action={dividir} className="flex flex-col gap-4">
      <input type="hidden" name="pedido_id" value={pedidoId} />

      {itens.map((item) => {
        const soma = somaDe(item.id);
        const fecha = soma === item.quantidade;
        return (
          <fieldset key={item.id} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-muted">{item.especie}</legend>
            <p className="text-sm text-muted">
              {item.recipiente} · {formatQuantidade(item.quantidade)} ao todo
            </p>
            <div className="grid grid-cols-2 gap-3">
              {cargas.map((carga, indice) => (
                <div key={indice}>
                  <input type="hidden" name="carga_indice" value={indice} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <TextField
                    label={`Carga ${indice + 1}`}
                    name="quantidade"
                    inputMode="numeric"
                    autoComplete="off"
                    value={carga[item.id] ?? '0'}
                    onChange={(event) => alterar(indice, item.id, event.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className={`text-sm font-semibold ${fecha ? 'text-green-800' : 'text-amber-900'}`}>
              {fecha
                ? `Fecha: ${formatQuantidade(soma)} de ${formatQuantidade(item.quantidade)}`
                : `Falta acertar: ${formatQuantidade(soma)} de ${formatQuantidade(item.quantidade)}`}
            </p>
          </fieldset>
        );
      })}

      <Button
        variant="outline"
        onClick={() => setCargas((atuais) => [...atuais, Object.fromEntries(itens.map((item) => [item.id, '0']))])}
      >
        Mais uma carga
      </Button>
      {cargas.length > 2 && (
        <Button variant="secondary" onClick={() => setCargas((atuais) => atuais.slice(0, -1))}>
          Tirar a última carga
        </Button>
      )}

      {divisao.error && <Notice tone="error">{divisao.error}</Notice>}
      {tudoFecha ? (
        <Button type="submit" pending={dividindo} pendingLabel="Organizando…">
          Confirmar a divisão
        </Button>
      ) : (
        <Notice tone="info">Acerte as quantidades até todo item fechar com o total dele.</Notice>
      )}
      <Button variant="secondary" onClick={() => setDividindoAberto(false)}>
        Voltar
      </Button>
    </form>
  );
}
