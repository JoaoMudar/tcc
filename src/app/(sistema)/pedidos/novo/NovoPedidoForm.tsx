'use client';

import { useActionState, useCallback, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import type { EspecieRef } from '@/lib/especies-form';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import type { PessoaRef } from '@/lib/pessoas-form';
import { type EspecieParaColagem, parseColagemTabular } from '@/lib/pedidos-colagem';
import { CANAIS_VENDA, CANAL_PADRAO } from '@/lib/pedidos-rotulos';
import { criarPedidoAction } from '../actions';
import { ClienteNovoTela } from './ClienteNovoTela';
import { ColarLista, type ItemImportado } from './ColarLista';
import { GradeItens } from './GradeItens';
import { ItemEmFoco } from './ItemEmFoco';
import { type Celula, type Linha, aplicarColagemTabular, estaVazia, linhaVazia, proximaChave } from './linhas-pedido';

/** Saldo pronto e em produção de cada par espécie e recipiente, lido na abertura da tela. */
export type SaldosPorChave = Record<string, { pronto: number; producao: number }>;

interface NovoPedidoFormProps {
  clientes: readonly SelectOption[];
  especies: readonly EspecieParaColagem[];
  recipientes: readonly SelectOption[];
  saldos: SaldosPorChave;
  /** O cadastro de cliente aberto daqui mostra os dados fiscais a quem pode vê-los (D4 §3.1). */
  verFiscal?: boolean;
}

const CANAL_OPCOES = Object.entries(CANAIS_VENDA).map(([value, label]) => ({ value, label }));

/**
 * T8.1, UC-31: cliente, canal e as linhas do pedido, que são uma planilha na
 * tela larga e uma lista no celular (`GradeItens`). Cada linha mostra o saldo de
 * muda pronta (RF-56), e o saldo menor que o pedido **avisa e não recusa**
 * (UC-31 FA-2): o viveiro vende com frequência muda que ainda vai ficar pronta,
 * e barrar isso transformaria uma venda normal em erro de sistema.
 *
 * **Não há preço aqui** (RN-50): quem registra está no meio de uma conversa e
 * anota o que o cliente quer. O valor se fecha depois da conferência, quando a
 * gerência já disse o que existe de verdade no pátio.
 */
export function NovoPedidoForm({ clientes, especies, recipientes, saldos, verFiscal = false }: NovoPedidoFormProps) {
  const [state, formAction, pending] = useActionState(criarPedidoAction, EMPTY_FORM_STATE);
  const fields = state.error ? state.fields : undefined;
  const [opcoesCliente, setOpcoesCliente] = useState(clientes);
  const [clienteId, setClienteId] = useState(fields?.cliente_id ?? '');
  const [abrirCliente, setAbrirCliente] = useState(false);
  const fecharCliente = useCallback(() => setAbrirCliente(false), []);
  const [canal, setCanal] = useState(fields?.canal ?? CANAL_PADRAO);
  const [catalogo, setCatalogo] = useState<EspecieParaColagem[]>([...especies]);
  const [linhas, setLinhas] = useState<Linha[]>([linhaVazia(1)]);
  const [colando, setColando] = useState<string | null>(null);
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const opcoesEspecie: SelectOption[] = catalogo.map((especie) => ({ value: especie.id, label: especie.nome }));

  const alterar = (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string | boolean) =>
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));

  // A última linha não se tira: o pedido sem linha nenhuma não teria onde digitar
  const remover = (chave: number) => {
    setLinhas((atuais) => (atuais.length > 1 ? atuais.filter((atual) => atual.chave !== chave) : atuais));
    setEmFoco(null);
  };

  /** No celular a linha nova já abre em tela cheia; na planilha ela fica ali, para digitar. */
  const adicionar = (abrirFicha: boolean) => {
    const chave = proximaChave(linhas);
    setLinhas((atuais) => [...atuais, linhaVazia(chave)]);
    if (abrirFicha) setEmFoco(chave);
  };

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
        altura: '',
        quantidade: item.quantidade,
      }));
      return [...base, ...novas];
    });
    setColando(null);
    setAviso(`${importados.length} ${importados.length === 1 ? 'item adicionado' : 'itens adicionados'}.`);
  }

  /**
   * O Ctrl+V na planilha. **O formato do texto decide o caminho**: o que veio de
   * planilha já tem as colunas separadas por tabulação e cai direto nas células;
   * o que veio da conversa é uma coluna de nomes, e passa pela revisão de
   * `ColarLista`, que é onde a espécie duvidosa é resolvida por alguém.
   */
  function aoColar(texto: string, foco: Celula | null) {
    const celulas = parseColagemTabular(texto);
    if (!celulas) {
      setColando(texto);
      return;
    }
    const inicio = foco ?? { linha: 0, coluna: 0 };
    setLinhas((atuais) =>
      aplicarColagemTabular(
        atuais,
        inicio,
        celulas,
        catalogo,
        recipientes.map((opcao) => ({ id: opcao.value, nome: opcao.label })),
      ),
    );
    setAviso(`${celulas.length} ${celulas.length === 1 ? 'linha colada' : 'linhas coladas'}. Confira as células em branco.`);
  }

  const linhaEmFoco = linhas.find((linha) => linha.chave === emFoco);

  return (
    <>
      {/* A colagem vem antes e o formulário fica escondido enquanto ela está
          aberta: no celular as duas coisas juntas seriam uma rolagem longa, e o
          formulário precisa continuar montado para não perder o que já tem.
          Fora do `<form>` também porque formulário dentro de formulário não é
          HTML válido, e a colagem tem os seus próprios botões de envio. */}
      {colando !== null && (
        <ColarLista
          especies={catalogo}
          recipientes={recipientes}
          textoInicial={colando}
          onImportar={anexarImportados}
          onEspecieNova={aoCriarEspecie}
          onFechar={() => setColando(null)}
        />
      )}

      <form action={formAction} className="flex flex-col gap-4" hidden={colando !== null}>
        {/* O `mt-7.5` centra o botão na altura do campo: rótulo e vão (24px)
            mais metade da diferença entre o campo (48px) e o botão (36px).
            O `w-auto!` precisa do `!`: sem ele o `w-full` do Button vence no
            CSS e o botão toma a linha inteira, espremendo o campo */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ComboboxField
              label="Cliente"
              name="cliente_id"
              options={opcoesCliente}
              value={clienteId}
              onChange={setClienteId}
              required
            />
          </div>
          <Button variant="outline" className="mt-7.5 h-9 min-h-0! w-auto! shrink-0 px-3! text-sm!" onClick={() => setAbrirCliente(true)}>
            + Novo
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Canal de venda"
            name="canal"
            options={CANAL_OPCOES}
            value={canal}
            onChange={(evento) => setCanal(evento.target.value)}
          />
          <TextField label="Entrega prevista (opcional)" name="data_entrega" type="date" defaultValue={fields?.data_entrega} />
        </div>
        <TextField label="Observação (opcional)" name="observacoes" maxLength={500} defaultValue={fields?.observacoes} />

        {aviso && <Notice tone="success">{aviso}</Notice>}

        <GradeItens
          linhas={linhas}
          opcoesEspecie={opcoesEspecie}
          recipientes={recipientes}
          saldos={saldos}
          onAlterar={alterar}
          onRemover={remover}
          onAdicionar={adicionar}
          onEditar={setEmFoco}
          onColar={aoColar}
          onColarLista={() => setColando('')}
        />

        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" pending={pending}>
          Registrar pedido
        </Button>
      </form>

      {linhaEmFoco && (
        <ItemEmFoco
          linha={linhaEmFoco}
          indice={linhas.indexOf(linhaEmFoco)}
          opcoesEspecie={opcoesEspecie}
          recipientes={recipientes}
          saldos={saldos}
          onAlterar={alterar}
          onRemover={remover}
          onFechar={() => setEmFoco(null)}
        />
      )}

      {abrirCliente && <ClienteNovoTela verFiscal={verFiscal} onCriado={aoCriarCliente} onFechar={fecharCliente} />}
    </>
  );
}
