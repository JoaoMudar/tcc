'use client';

import { useActionState, useCallback, useState } from 'react';
import { ClienteRapido } from '@/components/ClienteRapido';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { EspecieRef } from '@/lib/especies-form';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import type { PessoaRef } from '@/lib/pessoas-form';
import type { EspecieParaColagem } from '@/lib/pedidos-colagem';
import { CANAIS_VENDA, CANAL_PADRAO, chaveSaldo } from '@/lib/pedidos-rotulos';
import { criarPedidoAction } from '../actions';
import { ColarLista, type ItemImportado } from './ColarLista';

/** Saldo pronto e em produção de cada par espécie e recipiente, lido na abertura da tela. */
export type SaldosPorChave = Record<string, { pronto: number; producao: number }>;

interface NovoPedidoFormProps {
  clientes: readonly SelectOption[];
  especies: readonly EspecieParaColagem[];
  recipientes: readonly SelectOption[];
  saldos: SaldosPorChave;
}

interface Linha {
  chave: number;
  generico: boolean;
  especieId: string;
  recipienteId: string;
  quantidade: string;
}

const CANAL_OPCOES = Object.entries(CANAIS_VENDA).map(([value, label]) => ({ value, label }));

function linhaVazia(chave: number): Linha {
  return { chave, generico: false, especieId: '', recipienteId: '', quantidade: '' };
}

function estaVazia(linha: Linha): boolean {
  return !linha.generico && !linha.especieId && !linha.recipienteId && !linha.quantidade.trim();
}

/**
 * T8.1, UC-31: cliente, canal e as linhas do pedido. Cada linha mostra o saldo
 * de muda pronta ao lado (RF-56), e o saldo menor que o pedido **avisa e não
 * recusa** (UC-31 FA-2): o viveiro vende com frequência muda que ainda vai ficar
 * pronta, e barrar isso transformaria uma venda normal em erro de sistema.
 *
 * **Não há preço aqui** (RN-50): quem registra está no meio de uma conversa e
 * anota o que o cliente quer. O valor se fecha depois da conferência, quando a
 * gerência já disse o que existe de verdade no pátio.
 */
export function NovoPedidoForm({ clientes, especies, recipientes, saldos }: NovoPedidoFormProps) {
  const [state, formAction, pending] = useActionState(criarPedidoAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [opcoesCliente, setOpcoesCliente] = useState(clientes);
  const [clienteId, setClienteId] = useState(fields?.cliente_id ?? '');
  const [abrirCliente, setAbrirCliente] = useState(false);
  const [catalogo, setCatalogo] = useState<EspecieParaColagem[]>([...especies]);
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia(1)]);
  const [colando, setColando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const opcoesEspecie: SelectOption[] = catalogo.map((especie) => ({ value: especie.id, label: especie.nome }));

  const alterar = (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string | boolean) =>
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));

  const proximaChave = (atuais: readonly Linha[]) => Math.max(0, ...atuais.map((linha) => linha.chave)) + 1;

  // UC-31 FA-1: o cliente novo entra na lista e já fica escolhido, sem sair da tela
  const aoCriarCliente = useCallback((cliente: PessoaRef) => {
    setOpcoesCliente((atuais) =>
      atuais.some((opcao) => opcao.value === cliente.id) ? atuais : [...atuais, { value: cliente.id, label: cliente.nome }],
    );
    setClienteId(cliente.id);
    setAbrirCliente(false);
  }, []);

  const aoCriarEspecie = useCallback((especie: EspecieRef) => {
    setCatalogo((atuais) =>
      atuais.some((atual) => atual.id === especie.id)
        ? atuais
        : [
            ...atuais,
            {
              id: especie.id,
              nome: especie.nome,
              nomeCientifico: especie.nomeCientifico,
              nomesPopulares: especie.nomesPopulares,
            },
          ],
    );
  }, []);

  /**
   * Os itens colados entram como itens comuns. **A linha vazia inicial é
   * substituída**, e não empurrada para o fim: ela é o formulário em branco, e
   * não um item que alguém começou a preencher.
   */
  function anexarImportados(importados: ItemImportado[]) {
    setLinhas((atuais) => {
      const base = atuais.length === 1 && estaVazia(atuais[0]) ? [] : atuais;
      let chave = proximaChave(base);
      const novas = importados.map((item) => ({
        chave: chave++,
        generico: item.generico,
        especieId: item.especieId,
        recipienteId: item.recipienteId,
        quantidade: item.quantidade,
      }));
      return [...base, ...novas];
    });
    setColando(false);
    setAviso(`${importados.length} ${importados.length === 1 ? 'item adicionado' : 'itens adicionados'}.`);
  }

  return (
    <>
      {/* A colagem vem antes e o formulário fica escondido enquanto ela está
          aberta: no celular as duas coisas juntas seriam uma rolagem longa, e o
          formulário precisa continuar montado para não perder o que já tem.
          Fora do `<form>` também porque formulário dentro de formulário não é
          HTML válido, e a colagem tem os seus próprios botões de envio. */}
      {colando && (
        <ColarLista
          especies={catalogo}
          recipientes={recipientes}
          onImportar={anexarImportados}
          onEspecieNova={aoCriarEspecie}
          onFechar={() => setColando(false)}
        />
      )}

      <form action={formAction} className="flex flex-col gap-4" hidden={colando}>
        <ComboboxField label="Cliente" name="cliente_id" options={opcoesCliente} value={clienteId} onChange={setClienteId} />
        <Button variant="outline" onClick={() => setAbrirCliente(true)}>
          Cliente novo
        </Button>
        <SelectField label="Canal de venda" name="canal" options={CANAL_OPCOES} defaultValue={fields?.canal ?? CANAL_PADRAO} required />

        <div className="mt-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Itens</h2>
          {!colando && (
            <Button variant="outline" className="w-auto" onClick={() => setColando(true)}>
              📋 Colar lista
            </Button>
          )}
        </div>

        {aviso && <Notice tone="success">{aviso}</Notice>}

        {linhas.map((linha, indice) => {
          const saldo = saldos[chaveSaldo(linha.especieId, linha.recipienteId)];
          const pronto = saldo?.pronto ?? 0;
          const quantidade = lerQuantidade(linha.quantidade);
          const falta = linha.especieId && linha.recipienteId && quantidade !== null && quantidade > pronto;

          return (
            <fieldset key={linha.chave} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
              <legend className="px-1 text-sm font-semibold text-muted">Item {indice + 1}</legend>
              {/* Listas paralelas: uma posição por linha, lidas juntas no servidor */}
              <input type="hidden" name="item_generico" value={linha.generico ? '1' : '0'} />
              <input type="hidden" name="item_especificacao" value="" />

              {linha.generico ? (
                <>
                  <input type="hidden" name="item_especie" value="" />
                  <p className="text-base font-semibold text-blue-900">Espécie a definir na conferência</p>
                  <Button variant="secondary" onClick={() => alterar(linha.chave, 'generico', false)}>
                    Escolher a espécie agora
                  </Button>
                </>
              ) : (
                <ComboboxField
                  label="Espécie"
                  name="item_especie"
                  options={opcoesEspecie}
                  value={linha.especieId}
                  onChange={(valor) => alterar(linha.chave, 'especieId', valor)}
                />
              )}

              <ComboboxField
                label="Recipiente"
                name="item_recipiente"
                options={recipientes}
                value={linha.recipienteId}
                onChange={(valor) => alterar(linha.chave, 'recipienteId', valor)}
              />
              <TextField
                label="Quantidade"
                name="item_quantidade"
                inputMode="numeric"
                autoComplete="off"
                value={linha.quantidade}
                onChange={(event) => alterar(linha.chave, 'quantidade', event.target.value)}
                required
              />

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

        <Button variant="outline" onClick={() => setLinhas((atuais) => [...atuais, linhaVazia(proximaChave(atuais))])}>
          Mais um item
        </Button>

        <TextField label="Entrega prevista (opcional)" name="data_entrega" type="date" defaultValue={fields?.data_entrega} />
        <TextField label="Observação (opcional)" name="observacoes" maxLength={500} defaultValue={fields?.observacoes} />

        <Notice tone="info">O preço de cada item é informado depois da conferência no viveiro.</Notice>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" pending={pending}>
          Registrar pedido
        </Button>
      </form>

      {abrirCliente && <ClienteRapido onCriado={aoCriarCliente} onFechar={() => setAbrirCliente(false)} />}
    </>
  );
}
