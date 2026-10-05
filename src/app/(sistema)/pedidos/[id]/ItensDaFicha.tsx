'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EspecieRapida } from '@/components/EspecieRapida';
import { GradeItens } from '@/components/pedidos/GradeItens';
import { EnderecoDaEntrega } from '@/components/pedidos/EnderecoDaEntrega';
import { FechamentoDoPedido } from '@/components/pedidos/FechamentoDoPedido';
import { type ItemDaFicha, GradeItensFicha, type ValoresNegociacao } from '@/components/pedidos/GradeItensFicha';
import { ItemEmFoco } from '@/components/pedidos/ItemEmFoco';
import { type Linha, type SaldosPorChave, linhaVazia, proximaChave } from '@/components/pedidos/linhas-pedido';
import { Notice } from '@/components/ui/Notice';
import type { SelectOption } from '@/components/ui/SelectField';
import type { EspecieRef } from '@/lib/especies-form';
import type { FormState } from '@/lib/form-state';
import { ORIGEM_PADRAO, type OrigemFrete, freteParaCampo, pesoDoPedido } from '@/lib/frete';
import { lerQuantidade } from '@/lib/lotes-rotulos';
import {
  formatAltura,
  itemVendavel,
  parsePreco,
  precoParaCampo,
  quantidadeConfirmada,
  resumoFaltas,
  totalPedido,
} from '@/lib/pedidos-rotulos';
import {
  adicionarItemAction,
  atualizarItemAction,
  buscarEnderecosDoPedidoAction,
  negociarItensAction,
  removerItemAction,
  salvarEnderecoDoPedidoAction,
  salvarFreteAction,
  sugerirFreteAction,
  usarSuplenteAction,
} from '../actions';
import { ProximoPasso, type ProximoPassoProps } from './ProximoPasso';

/** Quanto a digitação espera parada antes de gravar: o bastante para não gravar a cada tecla. */
export const ATRASO_GRAVACAO_MS = 600;

interface ItensDaFichaProps {
  pedidoId: string;
  /** Orçamento edita a grade inteira; negociação, preço e quantidade; o resto só lê. */
  modo: 'cadastro' | 'negociacao' | 'leitura';
  itens: readonly ItemDaFicha[];
  saldos: SaldosPorChave;
  /** Só no modo cadastro: as opções das comboboxes. */
  opcoesEspecie?: readonly SelectOption[];
  recipientes?: readonly SelectOption[];
  faltaBloqueia?: boolean;
  proximoPasso: ProximoPassoProps;
  /** RN-64: o frete gravado no pedido. */
  frete?: { centavos: number | null; origem: OrigemFrete | null; distanciaKm: number | null };
  /** O título do modal do endereço de entrega, aberto pelo frete. */
  nomeCliente?: string;
}

/**
 * Gravações por chave, uma de cada vez, disparadas pela digitação parada.
 *
 * **A fila é por chave** porque a linha nova só ganha id quando a primeira
 * gravação volta: a segunda tem de esperar por ela, ou criaria o item duas
 * vezes. A tarefa lê o estado na hora de rodar (pelas refs), então a última
 * digitação é a que vale.
 */
function useFilaDeGravacao(atraso: number) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const tarefas = useRef(new Map<string, () => Promise<void>>());
  const filas = useRef(new Map<string, Promise<void>>());
  const [ocupadas, setOcupadas] = useState(0);

  const executar = useCallback((chave: string) => {
    const tarefa = tarefas.current.get(chave);
    tarefas.current.delete(chave);
    timers.current.delete(chave);
    const anterior = filas.current.get(chave) ?? Promise.resolve();
    const proxima = anterior
      .then(() => tarefa?.())
      .catch(() => undefined)
      .finally(() => setOcupadas((n) => n - 1));
    filas.current.set(chave, proxima);
  }, []);

  const agendar = useCallback(
    (chave: string, tarefa: () => Promise<void>, imediato = false) => {
      const timer = timers.current.get(chave);
      if (timer) clearTimeout(timer);
      else setOcupadas((n) => n + 1);
      tarefas.current.set(chave, tarefa);
      if (imediato) executar(chave);
      else timers.current.set(chave, setTimeout(() => executar(chave), atraso));
    },
    [atraso, executar],
  );

  // Sair da tela antes do atraso não perde o que foi digitado
  useEffect(() => {
    const pendentes = timers.current;
    const aRodar = tarefas.current;
    return () => {
      for (const [chave, timer] of pendentes) {
        clearTimeout(timer);
        void aRodar.get(chave)?.();
      }
    };
  }, []);

  return { agendar, salvando: ocupadas > 0 };
}

function linhaDoItem(item: ItemDaFicha, chave: number): Linha {
  return {
    chave,
    generico: item.generico,
    especieId: item.especieId ?? '',
    especificacao: item.especificacao ?? '',
    recipienteId: item.recipienteId ?? '',
    altura: formatAltura(item.alturaM),
    quantidade: item.quantidade === null ? '' : String(item.quantidade),
  };
}

/** O que a linha grava, sem a chave: é o que se compara para saber se mudou. */
const serial = (linha: Linha) => JSON.stringify({ ...linha, chave: undefined });

/** "≈ 84 km, ida e volta": de onde veio a sugestão. */
function textoDistancia(km: number | null): string | null {
  return km === null ? null : `Sugestão para ≈ ${km.toLocaleString('pt-BR')} km, ida e volta.`;
}

/**
 * RN-65: o peso que vai no caminhão. A quantidade é a que a grade mostra (a
 * confirmada no parcial), e o peso é o do recipiente em que o item vai: o
 * escolhido na negociação, ou o conferido, ou o pedido.
 */
function pesoDaFicha(itens: readonly ItemDaFicha[], valores: Readonly<Record<string, ValoresNegociacao>> | null) {
  return pesoDoPedido(
    itens
      .filter((item) => itemVendavel(item, itens) && !item.generico)
      .map((item) => {
        const parcial = item.disponivel === false && (item.quantidadeDisponivel ?? 0) > 0;
        const escolhido = valores?.[item.id]?.recipienteId || item.recipienteDisponivelId || item.recipienteId;
        const pesoKg =
          escolhido && escolhido === item.recipienteDisponivelId ? (item.pesoDisponivelKg ?? null) : (item.pesoKg ?? null);
        return { quantidade: parcial ? item.quantidadeDisponivel : item.quantidade, pesoKg };
      }),
  );
}

function valoresIniciais(itens: readonly ItemDaFicha[]): Record<string, ValoresNegociacao> {
  return Object.fromEntries(
    itens
      .filter((item) => itemVendavel(item, itens))
      .map((item) => {
        const confirmada = quantidadeConfirmada(item);
        return [
          item.id,
          {
            preco: item.precoCentavos === null ? '' : precoParaCampo(item.precoCentavos),
            // A quantidade vem preenchida com a confirmada: gravá-la é a chefia concordando com ela
            quantidade: item.generico || confirmada === null ? '' : String(confirmada),
            recipienteId: item.recipienteDisponivelId ?? item.recipienteId ?? '',
          },
        ];
      }),
  );
}

/**
 * Os itens na ficha do pedido, **gravados enquanto se digita**: não há botão de
 * salvar nem aviso de "salvo". O erro aparece em cima da grade, e a linha que
 * falhou tenta de novo na próxima alteração.
 *
 * - **Orçamento**: a mesma grade do cadastro (`GradeItens`), linha por linha.
 *   A linha nova vira item quando ganha espécie (ou Genérico).
 * - **Negociação** (RF-55): preço e quantidade na grade da ficha, gravados
 *   juntos por `negociarItensAction`, como o formulário que ela substituiu.
 * - **Leitura**: o resto.
 *
 * O próximo passo fica aqui, e não na página, porque "Aprovar" depende do que
 * está na grade agora: do que falta e de haver gravação em andamento.
 *
 * **O suplente não é item** (P18): sai da grade, do total e do peso, e aparece
 * embaixo do item de que é reserva.
 */
export function ItensDaFicha({
  pedidoId,
  modo,
  itens: todos,
  saldos,
  opcoesEspecie = [],
  recipientes = [],
  faltaBloqueia = false,
  proximoPasso,
  frete,
  nomeCliente,
}: ItensDaFichaProps) {
  const itens = useMemo(() => todos.filter((item) => !item.suplente), [todos]);
  const suplentes = useMemo(() => todos.filter((item) => item.suplente), [todos]);
  const { agendar, salvando } = useFilaDeGravacao(ATRASO_GRAVACAO_MS);
  const [erro, setErro] = useState<string | null>(null);
  const [usandoSuplente, setUsandoSuplente] = useState(false);

  const registrar = useCallback((resultado: FormState) => {
    setErro(resultado.error ?? null);
    return !resultado.error;
  }, []);

  // ---------------------------------------------------------------- orçamento
  const [linhas, setLinhas] = useState<Linha[]>(() => {
    const deTopo = itens.filter((item) => item.itemPaiId === null);
    return deTopo.length > 0 ? deTopo.map((item, indice) => linhaDoItem(item, indice + 1)) : [linhaVazia(1)];
  });
  const linhasRef = useRef(linhas);
  const ids = useRef(
    new Map(itens.filter((item) => item.itemPaiId === null).map((item, indice) => [indice + 1, item.id])),
  );
  const gravadas = useRef(new Map(linhas.map((linha) => [linha.chave, serial(linha)])));
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const [opcoes, setOpcoes] = useState(opcoesEspecie);
  const [criandoEspecie, setCriandoEspecie] = useState<{ chave: number; nome: string } | null>(null);

  const mudarLinhas = useCallback((mudar: (atuais: Linha[]) => Linha[]) => {
    linhasRef.current = mudar(linhasRef.current);
    setLinhas(linhasRef.current);
  }, []);

  const gravarLinha = useCallback(
    async (chave: number) => {
      const linha = linhasRef.current.find((atual) => atual.chave === chave);
      // Sem espécie ainda é linha sendo digitada, e não item: espera escolher
      if (!linha || (!linha.generico && !linha.especieId)) return;
      const texto = serial(linha);
      if (texto === gravadas.current.get(chave)) return;

      const dados = new FormData();
      dados.set('pedido_id', pedidoId);
      dados.set('item_generico', linha.generico ? '1' : '0');
      dados.set('item_especie', linha.generico ? '' : linha.especieId);
      dados.set('item_especificacao', linha.generico ? linha.especificacao : '');
      const itemId = ids.current.get(chave);
      let resultado: FormState & { itemId?: string };
      if (itemId) {
        dados.set('item_id', itemId);
        dados.set('recipiente', linha.recipienteId);
        dados.set('quantidade', linha.quantidade);
        dados.set('altura', linha.altura);
        resultado = await atualizarItemAction({}, dados);
      } else {
        dados.set('item_recipiente', linha.recipienteId);
        dados.set('item_quantidade', linha.quantidade);
        dados.set('item_altura', linha.altura);
        resultado = await adicionarItemAction({}, dados);
        if (resultado.itemId) ids.current.set(chave, resultado.itemId);
      }
      if (registrar(resultado)) gravadas.current.set(chave, texto);
    },
    [pedidoId, registrar],
  );

  const alterar = useCallback(
    (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string | boolean) => {
      mudarLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));
      agendar(`linha-${chave}`, () => gravarLinha(chave));
    },
    [agendar, gravarLinha, mudarLinhas],
  );

  // A última linha não se tira, se limpa, como no cadastro
  const remover = (chave: number) => {
    mudarLinhas((atuais) =>
      atuais.length > 1 ? atuais.filter((atual) => atual.chave !== chave) : [linhaVazia(proximaChave(atuais))],
    );
    setEmFoco(null);
    // Imediato, e na fila da linha: se ela ainda está sendo criada, espera o id
    agendar(
      `linha-${chave}`,
      async () => {
        const itemId = ids.current.get(chave);
        if (!itemId) return;
        const dados = new FormData();
        dados.set('pedido_id', pedidoId);
        dados.set('item_id', itemId);
        if (registrar(await removerItemAction({}, dados))) ids.current.delete(chave);
      },
      true,
    );
  };

  const adicionar = (abrirFicha: boolean) => {
    const chave = proximaChave(linhasRef.current);
    mudarLinhas((atuais) => [...atuais, linhaVazia(chave)]);
    if (abrirFicha) setEmFoco(chave);
  };

  // T8.16: a espécie cadastrada daqui entra nas opções e já fica escolhida na linha
  const chaveCriando = criandoEspecie?.chave;
  const aoCriarEspecie = useCallback(
    (especie: EspecieRef) => {
      setOpcoes((atuais) =>
        atuais.some((opcao) => opcao.value === especie.id)
          ? atuais
          : [...atuais, { value: especie.id, label: especie.nome }],
      );
      if (chaveCriando !== undefined) {
        alterar(chaveCriando, 'generico', false);
        alterar(chaveCriando, 'especieId', especie.id);
      }
      setCriandoEspecie(null);
    },
    [alterar, chaveCriando],
  );
  const fecharEspecie = useCallback(() => setCriandoEspecie(null), []);

  // --------------------------------------------------------------- negociação
  const [valores, setValores] = useState(() => valoresIniciais(itens));
  const valoresRef = useRef(valores);
  const negociacaoGravada = useRef(JSON.stringify(valores));

  const gravarNegociacao = useCallback(async () => {
    const texto = JSON.stringify(valoresRef.current);
    if (texto === negociacaoGravada.current) return;
    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    for (const item of itens) {
      const valor = valoresRef.current[item.id];
      if (!valor) continue;
      dados.append('negociar_item_id', item.id);
      dados.append('negociar_preco', valor.preco);
      dados.append('negociar_quantidade', item.generico ? '' : valor.quantidade);
      // O recipiente só vai quando havia escolha: um só não é decisão da chefia
      const escolha = item.recipienteDisponivelId && item.recipienteId && item.recipienteDisponivelId !== item.recipienteId;
      dados.append('negociar_recipiente', escolha ? valor.recipienteId : '');
    }
    if (registrar(await negociarItensAction({}, dados))) negociacaoGravada.current = texto;
  }, [itens, pedidoId, registrar]);

  // Antes do "Usar", o que está digitado vai para o banco: a página recomeça dele
  const usarSuplente = async (itemId: string) => {
    setUsandoSuplente(true);
    await gravarNegociacao();
    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    dados.set('item_id', itemId);
    registrar(await usarSuplenteAction({}, dados));
    setUsandoSuplente(false);
  };

  const alterarNegociacao = (itemId: string, campo: keyof ValoresNegociacao, valor: string) => {
    valoresRef.current = { ...valoresRef.current, [itemId]: { ...valoresRef.current[itemId], [campo]: valor } };
    setValores(valoresRef.current);
    // A troca de recipiente é um toque só, e grava na hora
    agendar('negociacao', gravarNegociacao, campo === 'recipienteId');
  };

  // O que falta, com o que está digitado agora, e não com o que o servidor já tem
  const itensAgora: ItemDaFicha[] =
    modo === 'negociacao'
      ? itens.map((item) => {
          const valor = valores[item.id];
          if (!valor) return item;
          const preco = parsePreco(valor.preco);
          const quantidade = item.generico ? null : lerQuantidade(valor.quantidade);
          return {
            ...item,
            precoCentavos: 'value' in preco ? preco.value : null,
            ...(quantidade === null ? {} : { quantidade, disponivel: true, quantidadeDisponivel: null }),
          };
        })
      : [...itens];

  // ------------------------------------------------------------------ frete
  const [freteTexto, setFreteTexto] = useState(() => freteParaCampo(frete?.centavos ?? null));
  const [origem, setOrigem] = useState<OrigemFrete>(frete?.origem ?? ORIGEM_PADRAO);
  const [distancia, setDistancia] = useState(() => textoDistancia(frete?.distanciaKm ?? null));
  const [avisoFrete, setAvisoFrete] = useState<string | null>(null);
  const [faltaEndereco, setFaltaEndereco] = useState<{ endereco: string | null } | null>(null);
  const [editandoEndereco, setEditandoEndereco] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const freteRef = useRef({ texto: freteTexto, origem });

  const gravarFrete = useCallback(async () => {
    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    dados.set('frete', freteRef.current.texto);
    dados.set('frete_origem', freteRef.current.origem);
    registrar(await salvarFreteAction({}, dados));
  }, [pedidoId, registrar]);

  const alterarFrete = (texto: string) => {
    freteRef.current = { ...freteRef.current, texto };
    setFreteTexto(texto);
    agendar('frete', gravarFrete);
  };

  const alterarOrigem = (nova: OrigemFrete) => {
    freteRef.current = { ...freteRef.current, origem: nova };
    setOrigem(nova);
    setDistancia(null);
  };

  // A sugestão só vem no toque, e o toque é a chefia aceitando-a: preenche e grava
  const sugerir = async () => {
    setSugerindo(true);
    setAvisoFrete(null);
    setFaltaEndereco(null);
    const resultado = await sugerirFreteAction(pedidoId, freteRef.current.origem);
    setSugerindo(false);
    if ('error' in resultado) {
      setAvisoFrete(resultado.error);
      setFaltaEndereco(resultado.falta ?? null);
      return;
    }
    setDistancia(textoDistancia(resultado.distanciaKm));
    alterarFrete(freteParaCampo(resultado.centavos));
  };

  // Endereço gravado: fecha e sugere de novo, que era o que a chefia queria
  const sugerirRef = useRef(sugerir);
  useEffect(() => {
    sugerirRef.current = sugerir;
  });
  const fecharEndereco = useCallback(() => setEditandoEndereco(false), []);
  const enderecoSalvo = useCallback(() => {
    setEditandoEndereco(false);
    void sugerirRef.current();
  }, []);

  const freteLido = parsePreco(freteTexto);
  const freteCentavos = modo === 'negociacao' ? ('value' in freteLido ? freteLido.value : null) : (frete?.centavos ?? null);
  const subtotal = totalPedido(itensAgora);
  const mostraFechamento = modo === 'negociacao' || (modo === 'leitura' && itens.some((item) => item.precoCentavos !== null));

  const linhaEmFoco = linhas.find((linha) => linha.chave === emFoco);

  return (
    <>
      <ProximoPasso {...proximoPasso} faltas={resumoFaltas(itensAgora)} salvando={salvando} />

      {erro && <Notice tone="error">{erro}</Notice>}

      {modo === 'cadastro' ? (
        <GradeItens
          linhas={linhas}
          opcoesEspecie={opcoes}
          recipientes={recipientes}
          saldos={saldos}
          onAlterar={alterar}
          onRemover={remover}
          onAdicionar={adicionar}
          onEditar={setEmFoco}
          onCriarEspecie={(chave, nome) => setCriandoEspecie({ chave, nome })}
        />
      ) : (
        <GradeItensFicha
          itens={itensAgora}
          conferidos={itens}
          saldos={saldos}
          valores={modo === 'negociacao' ? valores : undefined}
          onAlterar={modo === 'negociacao' ? alterarNegociacao : undefined}
          faltaBloqueia={faltaBloqueia}
          suplentes={suplentes}
          onUsarSuplente={modo === 'negociacao' ? usarSuplente : undefined}
          usandoSuplente={usandoSuplente}
        />
      )}

      {mostraFechamento && (
        <FechamentoDoPedido
          subtotalCentavos={subtotal}
          freteCentavos={freteCentavos}
          peso={pesoDaFicha(itensAgora, modo === 'negociacao' ? valores : null)}
          edicao={
            modo === 'negociacao'
              ? {
                  freteTexto,
                  origem,
                  distancia,
                  sugerindo,
                  aviso: avisoFrete,
                  onAlterarFrete: alterarFrete,
                  onAlterarOrigem: alterarOrigem,
                  onSugerir: sugerir,
                  falta: faltaEndereco && { ...faltaEndereco, onAbrir: () => setEditandoEndereco(true) },
                }
              : undefined
          }
        />
      )}

      {editandoEndereco && (
        <EnderecoDaEntrega
          nomeCliente={nomeCliente ?? ''}
          endereco={faltaEndereco?.endereco ?? null}
          acao={salvarEnderecoDoPedidoAction}
          buscar={buscarEnderecosDoPedidoAction}
          camposOcultos={{ pedido_id: pedidoId }}
          onFechar={fecharEndereco}
          onSalvo={enderecoSalvo}
        />
      )}

      {linhaEmFoco && (
        <ItemEmFoco
          linha={linhaEmFoco}
          indice={linhas.indexOf(linhaEmFoco)}
          opcoesEspecie={opcoes}
          recipientes={recipientes}
          saldos={saldos}
          onAlterar={alterar}
          onRemover={remover}
          onFechar={() => setEmFoco(null)}
          onCriarEspecie={(chave, nome) => setCriandoEspecie({ chave, nome })}
        />
      )}

      {criandoEspecie && (
        <EspecieRapida nomeSugerido={criandoEspecie.nome} onCriada={aoCriarEspecie} onFechar={fecharEspecie} />
      )}
    </>
  );
}
