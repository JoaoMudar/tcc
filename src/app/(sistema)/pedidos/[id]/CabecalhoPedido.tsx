'use client';

import { useState, useTransition } from 'react';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { CANAIS_VENDA } from '@/lib/pedidos-rotulos';
import { atualizarCabecalhoAction } from '../actions';

const CANAL_OPCOES = Object.entries(CANAIS_VENDA).map(([value, label]) => ({ value, label }));

interface Cabecalho {
  clienteId: string;
  canal: string;
  dataEntrega: string;
}

interface CabecalhoPedidoProps extends Cabecalho {
  pedidoId: string;
  clientes: readonly SelectOption[];
}

/**
 * Cliente, canal e entrega prevista, sempre editáveis para a chefia e o admin
 * (menos no cancelado). **Grava a cada troca**, como a grade de itens: não há
 * botão de salvar. O cliente só grava escolhido: a digitação que desfaz a
 * escolha é busca, e não "sem cliente".
 */
export function CabecalhoPedido({ pedidoId, clientes, ...inicial }: CabecalhoPedidoProps) {
  const [valores, setValores] = useState<Cabecalho>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function alterar(campo: keyof Cabecalho, valor: string) {
    const novos = { ...valores, [campo]: valor };
    setValores(novos);
    if (!novos.clienteId) return;
    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    dados.set('cliente_id', novos.clienteId);
    dados.set('canal', novos.canal);
    dados.set('data_entrega', novos.dataEntrega);
    startTransition(async () => {
      const resultado = await atualizarCabecalhoAction({}, dados);
      setErro(resultado.error ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ComboboxField
        label="Cliente"
        options={clientes}
        value={valores.clienteId}
        onChange={(valor) => alterar('clienteId', valor)}
        required
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Canal de venda"
          name="canal"
          options={CANAL_OPCOES}
          value={valores.canal}
          onChange={(evento) => alterar('canal', evento.target.value)}
          required
        />
        <TextField
          label="Entrega prevista"
          name="data_entrega"
          type="date"
          value={valores.dataEntrega}
          onChange={(evento) => alterar('dataEntrega', evento.target.value)}
        />
      </div>
      {erro && <Notice tone="error">{erro}</Notice>}
    </div>
  );
}
