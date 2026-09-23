'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { definirComposicaoAction } from './actions';

export interface GenericoParaCompor {
  id: string;
  /** Nula é a lista montada ("manda o que tiver"): não há soma a fechar. */
  quantidade: number | null;
  recipiente: string | null;
  recipienteId: string | null;
  especificacao: string | null;
  disponivel: boolean | null;
  /** Vazio é "qualquer espécie serve". */
  especiesPermitidas: readonly string[];
  filhos: readonly {
    id: string;
    especieId: string;
    especie: string;
    recipienteId: string;
    recipiente: string;
    quantidade: number;
  }[];
}

interface ComposicaoGenericoProps {
  pedidoId: string;
  item: GenericoParaCompor;
  especies: readonly SelectOption[];
  recipientes: readonly SelectOption[];
}

interface Linha {
  chave: number;
  especieId: string;
  recipienteId: string;
  quantidade: string;
}

/**
 * T8.12: o item que o cliente pediu sem escolher espécie ("500 mudas nativas,
 * no mínimo tubete"), e que a gerência resolve escolhendo quais entram.
 *
 * **O contador ao vivo é o que faz a tela funcionar**: a soma tem de fechar
 * exatamente, e descobrir isso só no envio faria a pessoa recomeçar a conta.
 * O botão de concluir só aparece quando fecha.
 *
 * **Sem quantidade no pedido, é a gerência montando a lista** ("manda o que
 * tiver de 17x22"): não há soma a fechar, o contador só diz quantas mudas a
 * lista tem, e cada espécie vira uma venda que a chefia precifica.
 */
export function ComposicaoGenerico({ pedidoId, item, especies, recipientes }: ComposicaoGenericoProps) {
  const [state, formAction, pending] = useActionState(definirComposicaoAction, EMPTY_FORM_STATE);

  // Recompor começa do que já está gravado, e não de uma tela em branco: quem
  // volta aqui quase sempre quer trocar uma espécie, não redigitar as cinco.
  const iniciais: Linha[] = item.filhos.length
    ? item.filhos.map((filho, indice) => ({
        chave: indice + 1,
        especieId: filho.especieId,
        recipienteId: filho.recipienteId,
        quantidade: String(filho.quantidade),
      }))
    : [{ chave: 1, especieId: '', recipienteId: item.recipienteId ?? '', quantidade: '' }];
  const [linhas, setLinhas] = useState<Linha[]>(iniciais);

  const alterar = (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string) =>
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));

  const soma = linhas.reduce((total, linha) => total + (lerQuantidade(linha.quantidade) ?? 0), 0);
  const listaMontada = item.quantidade === null;
  const restante = (item.quantidade ?? 0) - soma;
  const preenchidas = linhas.every((linha) => linha.especieId && linha.recipienteId && lerQuantidade(linha.quantidade));
  const completo = listaMontada ? preenchidas : restante === 0;

  // Escopo do cliente: sem lista, qualquer espécie serve (T8.7)
  const oferecidas =
    item.especiesPermitidas.length > 0
      ? especies.filter((opcao) => item.especiesPermitidas.includes(opcao.value))
      : especies;

  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${item.disponivel ? 'border-green-600 bg-green-50' : 'border-line bg-white'}`}>
      <div>
        <p className="text-sm font-bold tracking-widest text-muted uppercase">Item sem espécie definida</p>
        <p className="text-base font-bold text-ink">
          {listaMontada ? 'Lista a montar: quantas tiver' : `${formatQuantidade(item.quantidade!)} mudas`}
        </p>
        {item.recipiente && <p className="text-sm text-muted">Recipiente mínimo: {item.recipiente}</p>}
        {item.especificacao && <p className="mt-1 text-sm text-muted">Pedido do cliente: {item.especificacao}</p>}
        {item.especiesPermitidas.length > 0 && (
          <p className="mt-1 text-sm font-semibold text-amber-900">
            O cliente aceita {item.especiesPermitidas.length} espécie(s), e só elas aparecem na busca.
          </p>
        )}
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <input type="hidden" name="item_pai_id" value={item.id} />

        {linhas.map((linha, indice) => (
          <fieldset key={linha.chave} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3">
            <legend className="px-1 text-sm font-semibold text-muted">Espécie {indice + 1}</legend>
            <ComboboxField
              label="Espécie"
              name="composicao_especie"
              options={oferecidas}
              value={linha.especieId}
              onChange={(valor) => alterar(linha.chave, 'especieId', valor)}
            />
            {/* O recipiente pode ser outro que o mínimo, e a troca fica visível à chefia */}
            <SelectField
              label="Recipiente"
              name="composicao_recipiente"
              options={recipientes}
              value={linha.recipienteId}
              onChange={(event) => alterar(linha.chave, 'recipienteId', event.target.value)}
            />
            <TextField
              label="Quantidade"
              name="composicao_quantidade"
              inputMode="numeric"
              autoComplete="off"
              value={linha.quantidade}
              onChange={(event) => alterar(linha.chave, 'quantidade', event.target.value)}
            />
            {linhas.length > 1 && (
              <Button
                variant="secondary"
                onClick={() => setLinhas((atuais) => atuais.filter((atual) => atual.chave !== linha.chave))}
              >
                Tirar esta espécie
              </Button>
            )}
          </fieldset>
        ))}

        <Button
          variant="outline"
          onClick={() =>
            setLinhas((atuais) => [
              ...atuais,
              {
                chave: Math.max(...atuais.map((l) => l.chave)) + 1,
                especieId: '',
                recipienteId: item.recipienteId ?? '',
                quantidade: '',
              },
            ])
          }
        >
          Mais uma espécie
        </Button>

        <p
          className={`text-base font-bold ${completo ? 'text-green-800' : !listaMontada && restante < 0 ? 'text-red-700' : 'text-amber-900'}`}
        >
          {listaMontada
            ? `${formatQuantidade(soma)} mudas na lista`
            : completo
            ? 'Completo!'
            : restante > 0
              ? `Faltam ${formatQuantidade(restante)}`
              : `Passou ${formatQuantidade(-restante)}`}
        </p>

        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.success && <Notice tone="success">{state.success}</Notice>}

        {completo && (
          <Button type="submit" pending={pending}>
            Composição definida
          </Button>
        )}
      </form>

      {item.filhos.length > 0 && (
        <div className="rounded-lg border border-green-600 bg-white p-3">
          <p className="text-sm font-bold text-green-800">Composição gravada</p>
          <ul className="mt-1 flex flex-col gap-1">
            {item.filhos.map((filho) => (
              <li key={filho.id} className="text-sm text-ink">
                {filho.especie} · {filho.recipiente} · {formatQuantidade(filho.quantidade)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
