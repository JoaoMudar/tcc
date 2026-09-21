'use client';

import { useActionState, useCallback, useState } from 'react';
import { ClienteRapido } from '@/components/ClienteRapido';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import type { PessoaRef } from '@/lib/pessoas-form';
import {
  CANAIS_VENDA,
  CANAL_PADRAO,
  chaveSaldo,
  formatMoeda,
  parsePreco,
  totalPedido,
} from '@/lib/pedidos-rotulos';
import { criarPedidoAction } from '../actions';

/** Saldo pronto e em produção de cada par espécie e recipiente, lido na abertura da tela. */
export type SaldosPorChave = Record<string, { pronto: number; producao: number }>;

interface NovoPedidoFormProps {
  clientes: readonly SelectOption[];
  especies: readonly SelectOption[];
  recipientes: readonly SelectOption[];
  saldos: SaldosPorChave;
}

interface Linha {
  chave: number;
  especieId: string;
  recipienteId: string;
  quantidade: string;
  preco: string;
}

const CANAL_OPCOES = Object.entries(CANAIS_VENDA).map(([value, label]) => ({ value, label }));

function linhaVazia(chave: number): Linha {
  return { chave, especieId: '', recipienteId: '', quantidade: '', preco: '' };
}

/**
 * T8.1, UC-31: cliente, canal e as linhas do pedido. Cada linha mostra o saldo
 * de muda pronta ao lado (RF-56), e o saldo menor que o pedido **avisa e não
 * recusa** (UC-31 FA-2): o viveiro vende com frequência muda que ainda vai ficar
 * pronta, e barrar isso transformaria uma venda normal em erro de sistema.
 */
export function NovoPedidoForm({ clientes, especies, recipientes, saldos }: NovoPedidoFormProps) {
  const [state, formAction, pending] = useActionState(criarPedidoAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [opcoesCliente, setOpcoesCliente] = useState(clientes);
  const [clienteId, setClienteId] = useState(fields?.cliente_id ?? '');
  const [abrirCliente, setAbrirCliente] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia(1)]);

  const alterar = (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string) =>
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));

  // UC-31 FA-1: o cliente novo entra na lista e já fica escolhido, sem sair da tela
  const aoCriarCliente = useCallback((cliente: PessoaRef) => {
    setOpcoesCliente((atuais) =>
      atuais.some((opcao) => opcao.value === cliente.id) ? atuais : [...atuais, { value: cliente.id, label: cliente.nome }],
    );
    setClienteId(cliente.id);
    setAbrirCliente(false);
  }, []);

  const calculaveis = linhas.flatMap((linha) => {
    const quantidade = lerQuantidade(linha.quantidade);
    const preco = parsePreco(linha.preco);
    return quantidade !== null && 'value' in preco ? [{ quantidade, precoCentavos: preco.value }] : [];
  });

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <SelectField
          label="Cliente"
          name="cliente_id"
          options={opcoesCliente}
          value={clienteId}
          onChange={(event) => setClienteId(event.target.value)}
          required
        />
        <Button variant="outline" onClick={() => setAbrirCliente(true)}>
          Cliente novo
        </Button>
        <SelectField label="Canal de venda" name="canal" options={CANAL_OPCOES} defaultValue={fields?.canal ?? CANAL_PADRAO} required />

        <h2 className="mt-2 text-sm font-bold tracking-widest text-muted uppercase">Itens</h2>
        {linhas.map((linha, indice) => {
          const saldo = saldos[chaveSaldo(linha.especieId, linha.recipienteId)];
          const pronto = saldo?.pronto ?? 0;
          const quantidade = lerQuantidade(linha.quantidade);
          const falta = linha.especieId && linha.recipienteId && quantidade !== null && quantidade > pronto;

          return (
            <fieldset key={linha.chave} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
              <legend className="px-1 text-sm font-semibold text-muted">Item {indice + 1}</legend>
              <SelectField
                label="Espécie"
                name="item_especie"
                options={especies}
                value={linha.especieId}
                onChange={(event) => alterar(linha.chave, 'especieId', event.target.value)}
                required
              />
              <SelectField
                label="Recipiente"
                name="item_recipiente"
                options={recipientes}
                value={linha.recipienteId}
                onChange={(event) => alterar(linha.chave, 'recipienteId', event.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Quantidade"
                  name="item_quantidade"
                  inputMode="numeric"
                  autoComplete="off"
                  value={linha.quantidade}
                  onChange={(event) => alterar(linha.chave, 'quantidade', event.target.value)}
                  required
                />
                <TextField
                  label="Preço por muda"
                  name="item_preco"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="12,50"
                  value={linha.preco}
                  onChange={(event) => alterar(linha.chave, 'preco', event.target.value)}
                  required
                />
              </div>

              {linha.especieId && linha.recipienteId && (
                <p className={`text-sm ${falta ? 'text-amber-800' : 'text-muted'}`}>
                  Pronto para venda: <strong>{formatQuantidade(pronto)}</strong>
                  {saldo && saldo.producao > 0 && ` · ${formatQuantidade(saldo.producao)} em produção, ainda não pronta`}
                  {falta && ` · faltam ${formatQuantidade(quantidade - pronto)} para o que está sendo pedido`}
                </p>
              )}

              {linhas.length > 1 && (
                <Button
                  variant="secondary"
                  onClick={() => setLinhas((atuais) => atuais.filter((atual) => atual.chave !== linha.chave))}
                >
                  Tirar este item
                </Button>
              )}
            </fieldset>
          );
        })}

        <Button
          variant="outline"
          onClick={() => setLinhas((atuais) => [...atuais, linhaVazia(Math.max(...atuais.map((l) => l.chave)) + 1)])}
        >
          Mais um item
        </Button>

        <div className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-white p-4">
          <span className="text-base text-muted">Total do pedido</span>
          <span className="text-2xl font-bold text-ink">{formatMoeda(totalPedido(calculaveis))}</span>
        </div>

        <TextField label="Entrega prevista (opcional)" name="data_entrega" type="date" defaultValue={fields?.data_entrega} />
        <TextField label="Observação (opcional)" name="observacoes" maxLength={500} defaultValue={fields?.observacoes} />

        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" pending={pending}>
          Registrar pedido
        </Button>
      </form>

      {abrirCliente && <ClienteRapido onCriado={aoCriarCliente} onFechar={() => setAbrirCliente(false)} />}
    </>
  );
}
