'use client';

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
  quantidadeConfirmada,
  rotuloGenerico,
  rotuloGrupo,
  saldoDoItem,
} from '@/lib/pedidos-rotulos';
import {
  BARRA_CONFERENCIA,
  CLASSE_LINHA_PAI,
  CLASSE_OBRIGATORIO,
  type SaldosPorChave,
  TEXTO_OBRIGATORIO,
  conferenciaDoItem,
  confirmadaNaVerificacao,
  textoSaldo,
} from './linhas-pedido';

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
  /** O grupo do genérico (T8.7). Ausente ou vazio é "qualquer espécie serve". */
  especiesPermitidas?: readonly string[];
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
  /** Peso do recipiente cheio, pedido e conferido (RN-65). Ausente é "sem peso". */
  pesoKg?: number | null;
  pesoDisponivelKg?: number | null;
  /** O item que este completa (P13); no suplente, o item de que ele é reserva (P18). */
  complementaItemId?: string | null;
}

/** A espécie, ou o genérico com a observação e o tamanho do grupo: "Genérico: nativas · grupo de 3 espécies". */
function nomeDoItem(item: ItemDaFicha): string {
  if (item.especie) return item.especie;
  return [rotuloGenerico(item.especificacao), rotuloGrupo(item.especiesPermitidas?.length ?? 0)].filter(Boolean).join(' · ');
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
  /**
   * Pinta a barra da verificação no começo de cada linha (verde, amarelo,
   * vermelho). Só até a aprovação: depois dela todo item é "tem", e a cor não
   * diria nada.
   */
  mostraConferencia?: boolean;
  /** P18: os outros recipientes em que a espécie do item sem quantidade também está. Fora de `itens`. */
  suplentes?: readonly ItemDaFicha[];
  /** Presente só na negociação: o suplente vira linha do pedido. */
  onUsarSuplente?: (itemId: string) => void;
  usandoSuplente?: boolean;
  /**
   * Os itens como a conferência os deixou, sem o que se digitou na negociação:
   * o título do item dividido mostra o que foi pedido e o que temos, e isso não
   * muda enquanto a chefia digita. Sem ele, vale `itens`.
   */
  conferidos?: readonly ItemDaFicha[];
}

/** O título do item dividido: o que o cliente pediu e o que a conferência achou, somado. */
interface Titulo {
  item: ItemDaFicha;
  nome: string;
  saldo: ReturnType<typeof saldoDoItem> | undefined;
  /** O que a verificação contou somando as linhas, quando todas deram número. */
  confirmada: number | null;
  /** "Temos 30 de 50", ou "Temos em 17x22 e 20x26" quando falta número. */
  temos: string;
  completo: boolean;
}

/**
 * O que a conferência achou do item dividido, numa frase. Com número em todas
 * as linhas e quantidade pedida, a conta; sem isso, só onde a muda está.
 */
export function textoTemos(principal: ItemDaFicha, complementos: readonly ItemDaFicha[]): { temos: string; completo: boolean } {
  const linhas = [principal, ...complementos];
  const quantas = linhas.map((linha) => quantidadeConfirmada(linha));
  if (principal.quantidade !== null && quantas.every((n) => n !== null)) {
    const soma = quantas.reduce<number>((total, n) => total + n!, 0);
    return {
      temos: `Temos ${formatQuantidade(soma)} de ${formatQuantidade(principal.quantidade)}`,
      completo: soma >= principal.quantidade,
    };
  }
  const onde = linhas.map((linha) => linha.recipienteDisponivel ?? linha.recipiente).filter(Boolean);
  const lista = onde.length > 1 ? `${onde.slice(0, -1).join(', ')} e ${onde.at(-1)}` : (onde[0] ?? '');
  return { temos: `Temos em ${lista}`, completo: true };
}

/** O recipiente pedido e o conferido, quando diferem: a chefia escolhe entre os dois. */
function opcoesRecipiente(item: ItemDaFicha) {
  return [
    ...(item.recipienteId && item.recipiente ? [{ value: item.recipienteId, label: item.recipiente }] : []),
    ...(item.recipienteDisponivelId && item.recipienteDisponivel && item.recipienteDisponivelId !== item.recipienteId
      ? [
          {
            value: item.recipienteDisponivelId,
            label: item.recipienteDisponivel,
          },
        ]
      : []),
  ];
}

/** A célula obrigatória vazia não tem texto na tela: o vermelho diz, e o leitor de tela lê isto. */
function Obrigatorio() {
  return <span className="sr-only">{TEXTO_OBRIGATORIO}</span>;
}

/** O valor, ou a marca de obrigatório quando falta; nada quando o campo não se aplica. */
function valorOuObrigatorio(texto: string | null, falta: boolean) {
  if (texto) return texto;
  return falta ? <Obrigatorio /> : null;
}

const CLASSE_CELULA_CAMPO =
  'h-11 w-full bg-transparent px-3 text-base text-ink placeholder:text-gray-400 focus:bg-white focus:outline-2 focus:-outline-offset-2 focus:outline-brand';

/**
 * T8.1, RF-55: os itens do pedido na ficha, **com o mesmo desenho da grade do
 * cadastro** (`GradeItens`): planilha de `lg` para cima, lista no celular.
 *
 * Fora do orçamento a grade é leitura, e na negociação ganha a coluna de preço
 * e a quantidade vira campo. A célula que a aprovação ainda cobra fica vazia e
 * vermelha (`camposFaltando`), no lugar de um texto explicando o que falta.
 *
 * Os valores mostrados já são os que a aprovação vai gravar: a quantidade que a
 * conferência achou no parcial e o recipiente conferido no lugar do pedido.
 */
export function GradeItensFicha({
  itens,
  saldos,
  valores,
  onAlterar,
  mostraConferencia = false,
  suplentes = [],
  onUsarSuplente,
  usandoSuplente = false,
  conferidos,
}: GradeItensFichaProps) {
  const negociando = valores !== undefined && onAlterar !== undefined;
  const comPreco = negociando || itens.some((item) => item.precoCentavos !== null);

  if (itens.length === 0) return <p className="text-base text-muted">Nenhum item neste pedido.</p>;

  const saldoDe = (item: ItemDaFicha) =>
    item.especieId && item.recipienteId
      ? saldoDoItem(saldos[chaveSaldo(item.especieId, item.recipienteId)], item.alturaM)
      : undefined;

  const linhaDe = (item: ItemDaFicha, subitem: boolean) => {
    const falta: CamposFaltando = camposFaltando(item, itens);
    const parcial = item.disponivel === false && (item.quantidadeDisponivel ?? 0) > 0;
    // Só o item vendável se negocia; o genérico com quantidade só recebe preço,
    // porque a quantidade dele é a soma dos filhos
    const edita = negociando && itemVendavel(item, itens);
    return {
      tipo: 'item' as const,
      item,
      falta,
      filho: item.itemPaiId !== null || subitem,
      indisponivel: item.disponivel === false && item.quantidadeDisponivel === 0,
      conferencia: mostraConferencia ? conferenciaDoItem(item, itens) : null,
      quantidade: parcial ? item.quantidadeDisponivel : item.quantidade,
      recipiente: item.recipienteDisponivel ?? item.recipiente,
      altura: item.alturaDisponivelM ?? item.alturaM,
      // RN-06: o que atende é o pedido (espécie, recipiente e altura), e não o que a conferência achou.
      // No item dividido o saldo do pedido vai no título, e a linha do principal não o repete
      saldo: subitem && item.complementaItemId == null ? undefined : saldoDe(item),
      edita,
      editaQuantidade: edita && !item.generico,
      opcoes: edita ? opcoesRecipiente(item) : [],
      nome: nomeDoItem(item),
    };
  };
  type LinhaItem = ReturnType<typeof linhaDe>;

  /**
   * O item que se dividiu em mais de um recipiente ("Tem parte" completado,
   * "Tem tudo" dividido, suplente usado) vira **título com subitens**, como o
   * genérico: o título diz o que o cliente pediu e o que temos, e embaixo vêm as
   * linhas de verdade, o próprio item e os complementos, cada uma com seu preço.
   * O complemento sai do lugar em que a ordem do banco o pôs e vai para baixo do
   * título. A parte sem complemento continua uma linha só.
   */
  const complementosDe = new Map<string, ItemDaFicha[]>();
  for (const item of itens) {
    if (!item.complementaItemId || !itens.some((outro) => outro.id === item.complementaItemId)) continue;
    complementosDe.set(item.complementaItemId, [...(complementosDe.get(item.complementaItemId) ?? []), item]);
  }
  const doBanco = (item: ItemDaFicha) => conferidos?.find((outro) => outro.id === item.id) ?? item;

  const linhas: ({ tipo: 'titulo'; titulo: Titulo } | LinhaItem)[] = [];
  for (const item of itens) {
    if (item.complementaItemId && complementosDe.has(item.complementaItemId)) continue;
    const complementos = complementosDe.get(item.id);
    if (!complementos) {
      linhas.push(linhaDe(item, false));
      continue;
    }
    const pedido = doBanco(item);
    const contadas = [pedido, ...complementos.map(doBanco)].map(confirmadaNaVerificacao);
    linhas.push({
      tipo: 'titulo',
      titulo: {
        item: pedido,
        nome: nomeDoItem(item),
        saldo: saldoDe(pedido),
        confirmada: contadas.every((n) => n !== null) ? contadas.reduce<number>((soma, n) => soma + n!, 0) : null,
        ...textoTemos(pedido, complementos.map(doBanco)),
      },
    });
    linhas.push(linhaDe(item, true));
    for (const complemento of complementos) linhas.push(linhaDe(complemento, true));
  }
  // O número do campo conta as linhas de item: o título não tem campo, e não pula
  const numero = new Map<string, number>();
  for (const linha of linhas) if (linha.tipo === 'item') numero.set(linha.item.id, numero.size + 1);

  // O "Não tem" já está na frase da verificação: a quantidade fica vazia, porque não há o que vender
  const textoQuantidade = (linha: LinhaItem) =>
    linha.indisponivel
      ? ''
      : valorOuObrigatorio(linha.quantidade === null ? null : formatQuantidade(linha.quantidade), linha.falta.quantidade);

  const textoPreco = (linha: LinhaItem) =>
    valorOuObrigatorio(linha.item.precoCentavos === null ? null : formatMoeda(linha.item.precoCentavos), linha.falta.preco);

  /** A classe da célula de leitura: vermelha quando a aprovação ainda cobra o campo. */
  const celula = (falta: boolean) => (falta ? CLASSE_OBRIGATORIO : '');

  const campoPreco = (linha: LinhaItem, classe: string) => (
    <input
      aria-label={`Preço do item ${numero.get(linha.item.id)}`}
      inputMode="decimal"
      autoComplete="off"
      aria-invalid={linha.falta.preco || undefined}
      title={linha.falta.preco ? TEXTO_OBRIGATORIO : undefined}
      value={valores?.[linha.item.id]?.preco ?? ''}
      onChange={(evento) => onAlterar?.(linha.item.id, 'preco', evento.target.value)}
      className={`${classe} ${celula(linha.falta.preco)}`}
    />
  );

  const campoQuantidade = (linha: LinhaItem, classe: string) => (
    <input
      aria-label={`Quantidade do item ${numero.get(linha.item.id)}`}
      inputMode="numeric"
      autoComplete="off"
      aria-invalid={linha.falta.quantidade || undefined}
      title={linha.falta.quantidade ? TEXTO_OBRIGATORIO : undefined}
      value={valores?.[linha.item.id]?.quantidade ?? ''}
      onChange={(evento) => onAlterar?.(linha.item.id, 'quantidade', evento.target.value)}
      className={`${classe} ${celula(linha.falta.quantidade)}`}
    />
  );

  const campoRecipiente = (linha: LinhaItem, classe: string) => (
    <select
      aria-label={`Recipiente do item ${numero.get(linha.item.id)}`}
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

  /**
   * P18: o suplente não é linha: fica embaixo do item de que é reserva, com o
   * saldo do recipiente dele, para a chefia decidir se usa quando combinar a
   * quantidade e o primeiro recipiente não der conta.
   */
  const avisoSuplentes = (item: ItemDaFicha) => {
    const doItem = suplentes.filter((suplente) => suplente.complementaItemId === item.id);
    if (doItem.length === 0) return null;
    return (
      <span className="mt-1 flex flex-col gap-1.5">
        {doItem.map((suplente) => {
          const saldo =
            suplente.especieId && suplente.recipienteId
              ? saldoDoItem(saldos[chaveSaldo(suplente.especieId, suplente.recipienteId)], suplente.alturaM)
              : undefined;
          return (
            <span key={suplente.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-amber-900">
              <span>
                ↳ Se faltar: também tem em <strong>{suplente.recipiente}</strong>
                {saldo ? ` (${formatQuantidade(saldo.disponivel)} disponíveis)` : ''}
              </span>
              {onUsarSuplente && (
                <button
                  type="button"
                  disabled={usandoSuplente}
                  onClick={() => onUsarSuplente(suplente.id)}
                  className="min-h-9 rounded-lg border-[1.5px] border-amber-600 bg-amber-50 px-3 text-sm font-bold text-amber-900 active:bg-amber-100 disabled:opacity-60"
                >
                  Usar {suplente.recipiente}
                </button>
              )}
            </span>
          );
        })}
      </span>
    );
  };

  const corDaLinha = (linha: LinhaItem) => (linha.item.generico ? 'bg-blue-50' : linha.filho ? 'bg-gray-50' : '');
  const barraDa = (linha: LinhaItem) => (linha.conferencia ? BARRA_CONFERENCIA[linha.conferencia] : '');

  const nomeCientifico = (item: ItemDaFicha) =>
    item.nomeCientifico && item.nomeCientifico !== item.especie ? item.nomeCientifico : null;

  // Na linha pai (fundo escuro) o verde e o amarelo são os claros
  const textoTemosDo = (titulo: Titulo) => (
    <span className={`block text-sm font-semibold ${titulo.completo ? 'text-green-300' : 'text-amber-300'}`}>{titulo.temos}</span>
  );

  // O que o cliente pediu, no celular. O recipiente que ele não disse fica em branco: quem o define é o subitem
  const textoPedido = (titulo: Titulo) =>
    [titulo.item.recipiente, titulo.item.alturaM ? formatAltura(titulo.item.alturaM) : null].filter(Boolean).join(' · ');

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
            {linhas.map((linha) =>
              linha.tipo === 'titulo' ? (
                <tr key={`titulo-${linha.titulo.item.id}`} className={`border-t border-line align-top ${CLASSE_LINHA_PAI}`}>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold">{linha.titulo.nome}</span>
                    {nomeCientifico(linha.titulo.item) && (
                      <span className="block text-xs text-gray-300 italic">{nomeCientifico(linha.titulo.item)}</span>
                    )}
                    {linha.titulo.saldo !== undefined && (
                      <span className="block text-xs text-gray-300">
                        {textoSaldo(linha.titulo.saldo, linha.titulo.item.quantidade, linha.titulo.confirmada)}
                      </span>
                    )}
                    {textoTemosDo(linha.titulo)}
                    {avisoSuplentes(linha.titulo.item)}
                  </td>
                  <td className="border-l border-gray-600 px-3 py-2.5">{linha.titulo.item.recipiente}</td>
                  <td className="border-l border-gray-600 px-3 py-2.5">
                    {linha.titulo.item.alturaM ? formatAltura(linha.titulo.item.alturaM) : null}
                  </td>
                  <td className="border-l border-gray-600 px-3 py-2.5 text-right">
                    {linha.titulo.item.quantidade === null ? null : formatQuantidade(linha.titulo.item.quantidade)}
                  </td>
                  {comPreco && <td className="border-l border-gray-600" />}
                </tr>
              ) : (
                <tr key={linha.item.id} className={`border-t border-line align-top ${corDaLinha(linha)}`}>
                  <td className={`px-3 py-2.5 ${barraDa(linha)} ${celula(linha.falta.composicao)}`}>
                    <span className={`flex flex-wrap items-center gap-2 ${linha.filho ? 'pl-4' : ''}`}>
                      <span className="font-semibold text-ink">
                        {linha.filho && <span className="text-muted">↳ </span>}
                        {linha.nome}
                      </span>
                      {linha.falta.composicao && <Obrigatorio />}
                    </span>
                    {nomeCientifico(linha.item) && (
                      <span className={`block text-xs text-muted italic ${linha.filho ? 'pl-4' : ''}`}>
                        {nomeCientifico(linha.item)}
                      </span>
                    )}
                    {linha.saldo !== undefined && (
                      <span className={`block text-xs text-muted ${linha.filho ? 'pl-4' : ''}`}>
                        {textoSaldo(linha.saldo, linha.item.quantidade, confirmadaNaVerificacao(linha.item))}
                      </span>
                    )}
                    {!complementosDe.has(linha.item.id) && avisoSuplentes(linha.item)}
                  </td>
                  <td
                    className={`border-l border-line ${linha.opcoes.length > 1 ? 'p-0' : 'px-3 py-2.5'} ${
                      linha.opcoes.length > 1 || linha.item.generico ? '' : celula(linha.falta.recipiente)
                    }`}
                  >
                    {linha.opcoes.length > 1
                      ? campoRecipiente(linha, CLASSE_CELULA_CAMPO)
                      : linha.item.generico
                        ? null
                        : valorOuObrigatorio(linha.recipiente, linha.falta.recipiente)}
                  </td>
                  <td className="border-l border-line px-3 py-2.5">{linha.altura ? formatAltura(linha.altura) : null}</td>
                  <td
                    className={`border-l border-line text-right ${
                      linha.editaQuantidade ? 'p-0' : `px-3 py-2.5 ${celula(linha.falta.quantidade)}`
                    }`}
                  >
                    {linha.editaQuantidade ? campoQuantidade(linha, `${CLASSE_CELULA_CAMPO} text-right`) : textoQuantidade(linha)}
                  </td>
                  {comPreco && (
                    <td
                      className={`border-l border-line text-right ${
                        linha.edita ? 'p-0' : `px-3 py-2.5 ${celula(linha.falta.preco)}`
                      }`}
                    >
                      {linha.edita ? campoPreco(linha, `${CLASSE_CELULA_CAMPO} text-right`) : textoPreco(linha)}
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* Lista: celular */}
      <div className="overflow-hidden rounded-xl border border-line bg-white lg:hidden">
        <ul className="flex flex-col divide-y divide-line">
          {linhas.map((linha) =>
            linha.tipo === 'titulo' ? (
              <li key={`titulo-${linha.titulo.item.id}`} className={`flex flex-col gap-1 px-4 py-3 ${CLASSE_LINHA_PAI}`}>
                <div className="grid grid-cols-[1fr_auto] items-start gap-x-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-semibold">{linha.titulo.nome}</span>
                    {textoPedido(linha.titulo) && (
                      <span className="text-sm text-gray-300">Pedido: {textoPedido(linha.titulo)}</span>
                    )}
                  </span>
                  {linha.titulo.item.quantidade !== null && (
                    <span className="text-base font-semibold">{formatQuantidade(linha.titulo.item.quantidade)}</span>
                  )}
                </div>
                {textoTemosDo(linha.titulo)}
                {avisoSuplentes(linha.titulo.item)}
              </li>
            ) : (
              <li key={linha.item.id} className={`flex flex-col gap-2 px-4 py-3 ${corDaLinha(linha)} ${barraDa(linha)}`}>
                <div className="grid grid-cols-[1fr_auto] items-start gap-x-3">
                  <span className={`flex min-w-0 flex-col gap-0.5 ${linha.filho ? 'pl-4' : ''}`}>
                    <span className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                      <span className={linha.falta.composicao ? `rounded px-1 ${CLASSE_OBRIGATORIO}` : undefined}>
                        {linha.filho && <span className="text-muted">↳ </span>}
                        {linha.nome}
                        {linha.falta.composicao && <Obrigatorio />}
                      </span>
                    </span>
                    {!linha.item.generico && (
                      <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
                        {linha.opcoes.length > 1 ? null : (
                          <span
                            className={linha.falta.recipiente ? `inline-block h-5 w-16 rounded ${CLASSE_OBRIGATORIO}` : undefined}
                          >
                            {valorOuObrigatorio(linha.recipiente, linha.falta.recipiente)}
                          </span>
                        )}
                        {linha.altura ? <span>· {formatAltura(linha.altura)}</span> : null}
                      </span>
                    )}
                  </span>
                  {!linha.editaQuantidade && (
                    <span
                      className={`text-base font-semibold text-ink ${
                        linha.falta.quantidade ? `inline-block h-7 w-14 rounded ${CLASSE_OBRIGATORIO}` : ''
                      }`}
                    >
                      {textoQuantidade(linha)}
                    </span>
                  )}
                </div>
                {!complementosDe.has(linha.item.id) && avisoSuplentes(linha.item)}

                {linha.edita ? (
                  <div className="grid grid-cols-2 gap-2">
                    {linha.opcoes.length > 1 &&
                      campoRecipiente(
                        linha,
                        'col-span-2 h-11 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink',
                      )}
                    {linha.editaQuantidade ? (
                      <label
                        className={`flex h-11 items-center gap-2 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 focus-within:border-brand-dark ${celula(linha.falta.quantidade)}`}
                      >
                        <span className="text-sm text-muted">Qtd</span>
                        {campoQuantidade(linha, 'min-w-0 flex-1 bg-transparent text-right text-base text-ink outline-none')}
                      </label>
                    ) : (
                      <span />
                    )}
                    <label
                      className={`flex h-11 items-center gap-2 rounded-lg border-[1.5px] border-gray-300 bg-white px-3 focus-within:border-brand-dark ${celula(linha.falta.preco)}`}
                    >
                      <span className="text-sm text-muted">R$</span>
                      {campoPreco(linha, 'min-w-0 flex-1 bg-transparent text-right text-base text-ink outline-none')}
                    </label>
                  </div>
                ) : (
                  comPreco &&
                  itemVendavel(linha.item, itens) && (
                    <span
                      className={`self-end text-sm text-ink ${linha.falta.preco ? `inline-block h-7 w-20 rounded ${CLASSE_OBRIGATORIO}` : ''}`}
                    >
                      {textoPreco(linha)}
                    </span>
                  )
                )}
              </li>
            ),
          )}
        </ul>
      </div>
    </>
  );
}
