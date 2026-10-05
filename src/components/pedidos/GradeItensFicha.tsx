'use client';

import type { ReactNode } from 'react';
import { MARCA_OBRIGATORIO } from '@/components/ui/marcaObrigatorio';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import {
  type CamposFaltando,
  type ItemParaAprovar,
  camposFaltando,
  chaveSaldo,
  formatAltura,
  formatMoeda,
  itemVendavel,
  rotuloGenerico,
  saldoDoItem,
} from '@/lib/pedidos-rotulos';
import { type SaldosPorChave, textoSaldo } from './linhas-pedido';

/** O item como a ficha o recebe do servidor: o pedido e o que a conferência achou. */
export interface ItemDaFicha extends ItemParaAprovar {
  especieId: string | null;
  especie: string | null;
  nomeCientifico: string | null;
  recipiente: string | null;
  recipienteDisponivel: string | null;
  recipienteDisponivelId: string | null;
  alturaM: number | null;
  alturaDisponivelM: number | null;
  itemPaiId: string | null;
  especificacao: string | null;
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
}

/** O que a chefia digita na negociação, por item. Texto, porque os campos são controlados. */
export interface ValoresNegociacao {
  preco: string;
  quantidade: string;
  recipienteId: string;
}

interface GradeItensFichaProps {
  itens: readonly ItemDaFicha[];
  saldos: SaldosPorChave;
  /** Presente só na negociação: sem ele a grade é só leitura. */
  valores?: Readonly<Record<string, ValoresNegociacao>>;
  onAlterar?: (itemId: string, campo: keyof ValoresNegociacao, valor: string) => void;
  /** Na fase de aprovação a falta impede o próximo passo, e o "Definir" fica vermelho. */
  faltaBloqueia?: boolean;
}

/** O recipiente pedido e o conferido, quando diferem: a chefia escolhe entre os dois. */
function opcoesRecipiente(item: ItemDaFicha) {
  return [
    ...(item.recipienteId && item.recipiente ? [{ value: item.recipienteId, label: item.recipiente }] : []),
    ...(item.recipienteDisponivelId && item.recipienteDisponivel && item.recipienteDisponivelId !== item.recipienteId
      ? [{ value: item.recipienteDisponivelId, label: item.recipienteDisponivel }]
      : []),
  ];
}

function Definir({ bloqueia }: { bloqueia: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
        bloqueia ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      Definir
    </span>
  );
}

/** O que a célula mostra: o valor, "Definir" quando falta, ou nada quando o campo não se aplica. */
function valorOuDefinir(texto: string | null, falta: boolean, bloqueia: boolean): ReactNode {
  if (texto) return texto;
  return falta ? <Definir bloqueia={bloqueia} /> : null;
}

const CLASSE_CELULA_CAMPO =
  'h-11 w-full bg-transparent px-3 text-base text-ink placeholder:text-gray-400 focus:bg-white focus:outline-2 focus:-outline-offset-2 focus:outline-brand';

/**
 * T8.1, RF-55: os itens do pedido na ficha, **com o mesmo desenho da grade do
 * cadastro** (`GradeItens`): planilha de `lg` para cima, lista no celular.
 *
 * Fora do orçamento a grade é leitura, e na negociação ganha a coluna de preço
 * e a quantidade vira campo. A célula que a aprovação ainda cobra diz "Definir"
 * (`camposFaltando`), no lugar de um texto explicando o que falta.
 *
 * Os valores mostrados já são os que a aprovação vai gravar: a quantidade que a
 * conferência achou no parcial e o recipiente conferido no lugar do pedido.
 */
export function GradeItensFicha({ itens, saldos, valores, onAlterar, faltaBloqueia = false }: GradeItensFichaProps) {
  const negociando = valores !== undefined && onAlterar !== undefined;
  const comPreco = negociando || itens.some((item) => item.precoCentavos !== null);

  if (itens.length === 0) return <p className="text-base text-muted">Nenhum item neste pedido.</p>;

  const linhas = itens.map((item) => {
    const falta: CamposFaltando = camposFaltando(item, itens);
    const filho = item.itemPaiId !== null;
    const indisponivel = item.disponivel === false && item.quantidadeDisponivel === 0;
    const parcial = item.disponivel === false && (item.quantidadeDisponivel ?? 0) > 0;
    const quantidade = parcial ? item.quantidadeDisponivel : item.quantidade;
    const recipiente = item.recipienteDisponivel ?? item.recipiente;
    const altura = item.alturaDisponivelM ?? item.alturaM;
    // RN-06: o que atende é o pedido (espécie, recipiente e altura), e não o que a conferência achou
    const saldo =
      item.especieId && item.recipienteId
        ? saldoDoItem(saldos[chaveSaldo(item.especieId, item.recipienteId)], item.alturaM)
        : undefined;
    // Só o item vendável se negocia; o genérico com quantidade só recebe preço,
    // porque a quantidade dele é a soma dos filhos
    const edita = negociando && itemVendavel(item, itens);
    return {
      item,
      falta,
      filho,
      indisponivel,
      quantidade,
      recipiente,
      altura,
      saldo,
      edita,
      editaQuantidade: edita && !item.generico,
      opcoes: edita ? opcoesRecipiente(item) : [],
      nome: item.especie ?? rotuloGenerico(item.especificacao),
    };
  });

  const textoQuantidade = (linha: (typeof linhas)[number]) =>
    linha.indisponivel
      ? 'Não tem'
      : valorOuDefinir(linha.quantidade === null ? null : formatQuantidade(linha.quantidade), linha.falta.quantidade, faltaBloqueia);

  const textoPreco = (linha: (typeof linhas)[number]) =>
    valorOuDefinir(
      linha.item.precoCentavos === null ? null : formatMoeda(linha.item.precoCentavos),
      linha.falta.preco,
      faltaBloqueia,
    );

  const campoPreco = (linha: (typeof linhas)[number], indice: number, classe: string) => (
    <input
      aria-label={`Preço do item ${indice + 1}`}
      inputMode="decimal"
      autoComplete="off"
      placeholder={linha.falta.preco ? 'Definir' : '0,00'}
      value={valores?.[linha.item.id]?.preco ?? ''}
      onChange={(evento) => onAlterar?.(linha.item.id, 'preco', evento.target.value)}
      className={`${classe} ${linha.falta.preco ? (faltaBloqueia ? 'placeholder:text-red-600' : 'placeholder:text-amber-700') : ''}`}
    />
  );

  const campoQuantidade = (linha: (typeof linhas)[number], indice: number, classe: string) => (
    <input
      aria-label={`Quantidade do item ${indice + 1}`}
      inputMode="numeric"
      autoComplete="off"
      placeholder={linha.falta.quantidade ? 'Definir' : ''}
      value={valores?.[linha.item.id]?.quantidade ?? ''}
      onChange={(evento) => onAlterar?.(linha.item.id, 'quantidade', evento.target.value)}
      className={`${classe} ${linha.falta.quantidade ? (faltaBloqueia ? 'placeholder:text-red-600' : 'placeholder:text-amber-700') : ''}`}
    />
  );

  const campoRecipiente = (linha: (typeof linhas)[number], indice: number, classe: string) => (
    <select
      aria-label={`Recipiente do item ${indice + 1}`}
      value={valores?.[linha.item.id]?.recipienteId ?? ''}
      onChange={(evento) => onAlterar?.(linha.item.id, 'recipienteId', evento.target.value)}
      className={classe}
    >
      {linha.opcoes.map((opcao) => (
        <option key={opcao.value} value={opcao.value}>
          {opcao.label}
        </option>
      ))}
    </select>
  );

  const corDaLinha = (linha: (typeof linhas)[number]) =>
    linha.item.generico ? 'bg-blue-50' : linha.filho ? 'bg-gray-50' : '';

  return (
    <>
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Itens</h2>

      {/* Planilha: tela larga */}
      <div className="hidden rounded-xl border border-line bg-white lg:block">
        <table className="w-full table-fixed border-collapse text-base">
          <colgroup>
            <col />
            <col className="w-48" />
            <col className="w-28" />
            <col className="w-32" />
            {comPreco && <col className="w-32" />}
          </colgroup>
          <thead>
            <tr className="bg-surface text-left text-xs font-bold tracking-wide text-muted uppercase">
              <th scope="col" className={`rounded-tl-xl px-3 py-2 ${MARCA_OBRIGATORIO}`}>
                Espécie
              </th>
              <th scope="col" className="border-l border-line px-3 py-2">
                Recipiente
              </th>
              <th scope="col" className="border-l border-line px-3 py-2">
                Altura
              </th>
              <th scope="col" className={`border-l border-line px-3 py-2 text-right ${comPreco ? '' : 'rounded-tr-xl'}`}>
                Quantidade
              </th>
              {comPreco && (
                <th scope="col" className="rounded-tr-xl border-l border-line px-3 py-2 text-right">
                  Preço
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, indice) => (
              <tr key={linha.item.id} className={`border-t border-line align-top ${corDaLinha(linha)}`}>
                <td className="px-3 py-2.5">
                  <span className={`flex flex-wrap items-center gap-2 ${linha.filho ? 'pl-4' : ''}`}>
                    <span className="font-semibold text-ink">
                      {linha.filho && <span className="text-muted">↳ </span>}
                      {linha.nome}
                    </span>
                    {linha.falta.composicao && <Definir bloqueia={faltaBloqueia} />}
                  </span>
                  {linha.item.nomeCientifico && linha.item.nomeCientifico !== linha.item.especie && (
                    <span className={`block text-xs text-muted italic ${linha.filho ? 'pl-4' : ''}`}>
                      {linha.item.nomeCientifico}
                    </span>
                  )}
                  {linha.saldo !== undefined && (
                    <span className={`block text-xs text-muted ${linha.filho ? 'pl-4' : ''}`}>
                      {textoSaldo(linha.saldo, linha.item.quantidade)}
                    </span>
                  )}
                </td>
                <td className={`border-l border-line ${linha.opcoes.length > 1 ? 'p-0' : 'px-3 py-2.5'}`}>
                  {linha.opcoes.length > 1
                    ? campoRecipiente(linha, indice, CLASSE_CELULA_CAMPO)
                    : linha.item.generico
                      ? null
                      : valorOuDefinir(linha.recipiente, linha.falta.recipiente, faltaBloqueia)}
                </td>
                <td className="border-l border-line px-3 py-2.5">{linha.altura ? formatAltura(linha.altura) : null}</td>
                <td className={`border-l border-line text-right ${linha.editaQuantidade ? 'p-0' : 'px-3 py-2.5'}`}>
                  {linha.editaQuantidade
                    ? campoQuantidade(linha, indice, `${CLASSE_CELULA_CAMPO} text-right`)
                    : textoQuantidade(linha)}
                </td>
                {comPreco && (
                  <td className={`border-l border-line text-right ${linha.edita ? 'p-0' : 'px-3 py-2.5'}`}>
                    {linha.edita ? campoPreco(linha, indice, `${CLASSE_CELULA_CAMPO} text-right`) : textoPreco(linha)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lista: celular */}
      <div className="overflow-hidden rounded-xl border border-line bg-white lg:hidden">
        <ul className="flex flex-col divide-y divide-line">
          {linhas.map((linha, indice) => (
            <li key={linha.item.id} className={`flex flex-col gap-2 px-4 py-3 ${corDaLinha(linha)}`}>
              <div className="grid grid-cols-[1fr_auto] items-start gap-x-3">
                <span className={`flex min-w-0 flex-col gap-0.5 ${linha.filho ? 'pl-4' : ''}`}>
                  <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                    <span>
                      {linha.filho && <span className="text-muted">↳ </span>}
                      {linha.nome}
                    </span>
                    {linha.falta.composicao && <Definir bloqueia={faltaBloqueia} />}
                  </span>
                  {!linha.item.generico && (
                    <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
                      {linha.opcoes.length > 1 ? null : valorOuDefinir(linha.recipiente, linha.falta.recipiente, faltaBloqueia)}
                      {linha.altura ? <span>· {formatAltura(linha.altura)}</span> : null}
                    </span>
                  )}
                </span>
                {!linha.editaQuantidade && <span className="text-base font-semibold text-ink">{textoQuantidade(linha)}</span>}
              </div>

              {linha.edita ? (
                <div className="grid grid-cols-2 gap-2">
                  {linha.opcoes.length > 1 &&
                    campoRecipiente(
                      linha,
                      indice,
                      'col-span-2 h-11 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink',
                    )}
                  {linha.editaQuantidade ? (
                    <label className="flex h-11 items-center gap-2 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 focus-within:border-brand-dark">
                      <span className="text-sm text-muted">Qtd</span>
                      {campoQuantidade(linha, indice, 'min-w-0 flex-1 bg-transparent text-right text-base text-ink outline-none')}
                    </label>
                  ) : (
                    <span />
                  )}
                  <label className="flex h-11 items-center gap-2 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 focus-within:border-brand-dark">
                    <span className="text-sm text-muted">R$</span>
                    {campoPreco(linha, indice, 'min-w-0 flex-1 bg-transparent text-right text-base text-ink outline-none')}
                  </label>
                </div>
              ) : (
                comPreco &&
                itemVendavel(linha.item, itens) && (
                  <span className="self-end text-sm text-ink">{textoPreco(linha)}</span>
                )
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
