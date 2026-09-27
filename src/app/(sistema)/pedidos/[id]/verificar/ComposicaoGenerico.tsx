'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import {
  NADA_DIFERE,
  type EstadoDaResposta,
  type LinhaComposicao,
  alturaParaCampo,
  estadoDoGenerico,
  formatAltura,
  parseAltura,
  perguntasDoItem,
  rotuloGenerico,
  validarComposicaoGenerico,
} from '@/lib/pedidos-rotulos';
import { definirComposicaoAction, marcarGenericoIndisponivelAction } from './actions';
import { BotoesResposta, type Resposta } from './BotoesResposta';
import { COR_DO_ESTADO, CabecalhoItem } from './CabecalhoItem';
import { CampoObservacao } from './CampoObservacao';

export interface GenericoParaCompor {
  id: string;
  /** Nula é a lista montada ("manda o que tiver"): não há soma a fechar. */
  quantidade: number | null;
  recipiente: string | null;
  recipienteId: string | null;
  alturaM: number | null;
  especificacao: string | null;
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
  observacoesDisponibilidade: string | null;
  /** Vazio é "qualquer espécie serve". */
  especiesPermitidas: readonly string[];
  filhos: readonly {
    id: string;
    especieId: string;
    especie: string;
    recipienteId: string | null;
    recipiente: string | null;
    quantidade: number | null;
    alturaM: number | null;
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
  quantidade: string;
  recipienteId: string;
  altura: string;
}

type Modo = Exclude<Resposta, 'nao_tem'>;

/** Linha nova: em "Tem parte" já vem com o recipiente e a altura pedidos, para trocar só o que difere. */
function linhaNova(item: GenericoParaCompor, modo: Modo, chave: number): Linha {
  const parte = modo === 'parte';
  return {
    chave,
    especieId: '',
    quantidade: '',
    recipienteId: parte ? (item.recipienteId ?? '') : '',
    altura: parte ? alturaParaCampo(item.alturaM) : '',
  };
}

/** Recompor começa do que já está gravado: quem volta quase sempre quer trocar uma espécie, e não redigitar as cinco. */
function linhasIniciais(item: GenericoParaCompor, modo: Modo, gravada: EstadoDaResposta): Linha[] {
  if (gravada !== modo || item.filhos.length === 0) return [linhaNova(item, modo, 1)];
  return item.filhos.map((filho, indice) => ({
    chave: indice + 1,
    especieId: filho.especieId,
    quantidade: filho.quantidade === null ? '' : String(filho.quantidade),
    recipienteId: filho.recipienteId ?? '',
    altura: modo === 'parte' ? alturaParaCampo(filho.alturaM) : '',
  }));
}

/** A tela lê as linhas como a action vai ler: linha em branco não conta, e o que não se entende é erro. */
function lerLinhas(linhas: readonly Linha[]): { error: string } | { value: LinhaComposicao[] } {
  const lidas: LinhaComposicao[] = [];
  for (const [indice, linha] of linhas.entries()) {
    if (!linha.especieId && !linha.quantidade.trim()) continue;
    const posicao = `linha ${indice + 1}`;
    const texto = linha.quantidade.trim();
    const quantidade = texto === '' ? null : lerQuantidade(texto);
    if (texto !== '' && quantidade === null) {
      return { error: `Informe a quantidade da ${posicao}, um número inteiro maior que zero.` };
    }
    const altura = parseAltura(linha.altura);
    if ('error' in altura) return { error: `Na ${posicao}: ${altura.error.toLowerCase()}` };
    lidas.push({ especieId: linha.especieId, recipienteId: linha.recipienteId || null, quantidade, alturaM: altura.value });
  }
  return { value: lidas };
}

/** Só em "Tem parte", como no item com espécie: "Não tem" e "Tem tudo" o botão cheio já diz. */
function resumoDoGenerico(item: GenericoParaCompor, gravada: EstadoDaResposta): string | undefined {
  if (gravada !== 'parte') return undefined;
  const especies = item.filhos.length === 1 ? '1 espécie' : `${item.filhos.length} espécies`;
  if (item.quantidade === null) return `Tem parte: ${especies}`;
  const soma = item.quantidadeDisponivel ?? item.quantidade;
  return `Tem parte: ${formatQuantidade(soma)} de ${formatQuantidade(item.quantidade)}, em ${especies}`;
}

/**
 * T8.12, P12: o item que o cliente pediu sem escolher espécie ("500 mudas
 * nativas, em tubete"). **Os mesmos três botões do item com espécie**, e a
 * resposta com muda é a lista de espécies que o atende, uma linha por espécie,
 * com os campos que a regra pede (`perguntasDoItem`, no modo genérico).
 *
 * **O contador ao vivo é o que faz a tela funcionar**: em "Tem tudo" a soma tem
 * de fechar exatamente, e descobrir isso só no envio faria a pessoa recomeçar a
 * conta.
 *
 * **Não há "Gravar"**, como no item com espécie: cada campo grava ao sair dele,
 * e só quando a regra fecha, que é a mesma do servidor
 * (`validarComposicaoGenerico`). Enquanto não fecha, o contador diz o porquê.
 * O servidor apaga e regrava a composição inteira, e por isso gravar a cada
 * campo não acumula espécies.
 */
export function ComposicaoGenerico({ pedidoId, item, especies, recipientes }: ComposicaoGenericoProps) {
  const [state, formAction, pending] = useActionState(definirComposicaoAction, EMPTY_FORM_STATE);
  const [estadoNaoTem, naoTemAction, gravandoNaoTem] = useActionState(marcarGenericoIndisponivelAction, EMPTY_FORM_STATE);
  const gravada = estadoDoGenerico(item, item.filhos);
  const perguntas = perguntasDoItem(item, true);

  const [aberta, setAberta] = useState<Modo | null>(gravada === 'parte' || gravada === 'tudo' ? gravada : null);
  const [linhas, setLinhas] = useState<Linha[]>(() => (aberta ? linhasIniciais(item, aberta, gravada) : []));
  const [observacao, setObservacao] = useState(item.observacoesDisponibilidade ?? '');
  // O último botão tocado: "Não tem" não abre painel, e o cartão tem de pintar mesmo assim
  const [tocada, setTocada] = useState<Resposta | null>(null);
  // O que já está no banco: sair do campo sem mudar nada não regrava
  const gravado = useRef<string | null>(
    aberta && gravada === aberta ? JSON.stringify([aberta, linhas, observacao]) : null,
  );

  function gravarNaoTem() {
    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    dados.set('item_pai_id', item.id);
    dados.set('observacoes', observacao);
    startTransition(() => naoTemAction(dados));
  }

  function escolher(resposta: Resposta) {
    setTocada(resposta);
    if (resposta === 'nao_tem') {
      setAberta(null);
      gravarNaoTem();
      return;
    }
    setAberta(resposta);
    setLinhas(linhasIniciais(item, resposta, gravada));
  }

  /** Grava a composição quando a regra fecha; antes disso, o contador explica. */
  function enviar(modo: Modo, proximas: readonly Linha[]) {
    const lidas = lerLinhas(proximas);
    if ('error' in lidas) return;
    const estado = modo === 'parte' ? 'parcial' : 'disponivel';
    if ('error' in validarComposicaoGenerico(item, lidas.value, item.especiesPermitidas, estado)) return;

    const chave = JSON.stringify([modo, proximas, observacao]);
    // Repetir só vale se o banco já tem exatamente isto: depois de erro, vai de novo
    if (chave === gravado.current && !state.error) return;
    gravado.current = chave;

    const perguntadas = new Set((modo === 'parte' ? perguntas.parte : perguntas.tudo).map((p) => p.campo));
    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    dados.set('item_pai_id', item.id);
    dados.set('estado', estado);
    dados.set('observacoes', observacao);
    // As listas vão paralelas: campo que a regra não pergunta vai vazio, e o servidor herda do genérico
    for (const linha of proximas) {
      dados.append('composicao_especie', linha.especieId);
      dados.append('composicao_quantidade', perguntadas.has('quantidade') ? linha.quantidade : '');
      dados.append('composicao_recipiente', perguntadas.has('recipiente') ? linha.recipienteId : '');
      dados.append('composicao_altura', perguntadas.has('altura') ? linha.altura : '');
    }
    startTransition(() => formAction(dados));
  }

  /** `gravar` é o fim da edição do campo: sair dele, ou escolher na lista. */
  function alterar(chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string, gravar = false) {
    const proximas = linhas.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha));
    setLinhas(proximas);
    if (gravar && aberta) enviar(aberta, proximas);
  }

  function tirar(chave: number) {
    const proximas = linhas.filter((linha) => linha.chave !== chave);
    setLinhas(proximas);
    if (aberta) enviar(aberta, proximas);
  }

  // Escopo do cliente: sem lista, qualquer espécie serve (T8.7)
  const oferecidas =
    item.especiesPermitidas.length > 0
      ? especies.filter((opcao) => item.especiesPermitidas.includes(opcao.value))
      : especies;

  const lidas = lerLinhas(linhas);
  const validada =
    aberta && 'value' in lidas ? validarComposicaoGenerico(item, lidas.value, item.especiesPermitidas, aberta === 'parte' ? 'parcial' : 'disponivel') : null;
  const completo = validada !== null && 'value' in validada;
  const soma = 'value' in lidas ? lidas.value.reduce((total, linha) => total + (linha.quantidade ?? 0), 0) : 0;
  const escolheuAlguma = linhas.some((linha) => linha.especieId);
  const erro = 'error' in lidas ? lidas.error : validada && 'error' in validada ? validada.error : null;
  // "Nada difere" não vira aviso, como no item com espécie: a regra continua, só a frase sai
  const falha = erro === NADA_DIFERE ? null : erro;

  let contador: string;
  if (item.quantidade === null) {
    contador = soma > 0 ? `${formatQuantidade(soma)} mudas na lista` : `${linhas.filter((l) => l.especieId).length} espécie(s) na lista`;
  } else if (aberta === 'parte') {
    contador = `${formatQuantidade(soma)} de ${formatQuantidade(item.quantidade)}`;
  } else {
    const restante = item.quantidade - soma;
    contador = restante === 0 ? 'Fechou!' : restante > 0 ? `Faltam ${formatQuantidade(restante)}` : `Passou ${formatQuantidade(-restante)}`;
  }

  const lista = aberta === 'parte' ? perguntas.parte : perguntas.tudo;
  const pergunta = (campo: 'quantidade' | 'recipiente' | 'altura') => lista.find((p) => p.campo === campo);
  // O cartão pinta no toque: a cor diz o que a pessoa escolheu, antes de gravar
  const selecionada = aberta ?? tocada ?? (gravada === 'pendente' ? null : gravada);

  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${COR_DO_ESTADO[selecionada ?? 'pendente']}`}>
      <CabecalhoItem
        sobretitulo="Sem espécie definida"
        titulo={rotuloGenerico(item.especificacao)}
        quantidade={item.quantidade}
        recipiente={item.recipiente}
        alturaM={item.alturaM}
        estado={gravada}
        resumo={resumoDoGenerico(item, gravada)}
      >
        {item.especiesPermitidas.length > 0 && (
          <p className="text-sm font-semibold text-amber-900">
            O cliente aceita {item.especiesPermitidas.length} espécie(s), e só elas aparecem na busca.
          </p>
        )}
      </CabecalhoItem>

      {item.filhos.length > 0 && !aberta && (
        <ul className="flex flex-col gap-1 rounded-lg border border-line bg-white p-3">
          {item.filhos.map((filho) => (
            <li key={filho.id} className="text-sm text-ink">
              {[
                filho.especie,
                filho.recipiente,
                filho.quantidade === null ? null : formatQuantidade(filho.quantidade),
                filho.alturaM === null ? null : formatAltura(filho.alturaM),
              ]
                .filter(Boolean)
                .join(' · ')}
            </li>
          ))}
        </ul>
      )}

      <BotoesResposta
        perguntas={perguntas}
        selecionada={selecionada}
        pending={pending || gravandoNaoTem}
        onEscolher={escolher}
      />

      {aberta && (
        <div className="flex flex-col gap-3">

          {linhas.map((linha, indice) => {
            const quantidade = pergunta('quantidade');
            const recipiente = pergunta('recipiente');
            const altura = pergunta('altura');
            return (
              <fieldset key={linha.chave} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3">
                <legend className="px-1 text-sm font-semibold text-muted">Espécie {indice + 1}</legend>
                <ComboboxField
                  label="Espécie"
                  name="composicao_especie"
                  options={oferecidas}
                  value={linha.especieId}
                  onChange={(valor) => alterar(linha.chave, 'especieId', valor, true)}
                  required
                />
                {quantidade && (
                  <TextField
                    label="Quantas"
                    name="composicao_quantidade"
                    inputMode="numeric"
                    autoComplete="off"
                    required={quantidade.obrigatorio}
                    value={linha.quantidade}
                    onChange={(evento) => alterar(linha.chave, 'quantidade', evento.target.value)}
                    onBlur={() => alterar(linha.chave, 'quantidade', linha.quantidade, true)}
                  />
                )}
                {recipiente && (
                  <SelectField
                    label="Recipiente"
                    name="composicao_recipiente"
                    options={recipientes}
                    required={recipiente.obrigatorio}
                    value={linha.recipienteId}
                    onChange={(evento) => alterar(linha.chave, 'recipienteId', evento.target.value, true)}
                  />
                )}
                {altura && (
                  <TextField
                    label="Altura"
                    name="composicao_altura"
                    inputMode="decimal"
                    autoComplete="off"
                    required={altura.obrigatorio}
                    value={linha.altura}
                    onChange={(evento) => alterar(linha.chave, 'altura', evento.target.value)}
                    onBlur={() => alterar(linha.chave, 'altura', linha.altura, true)}
                  />
                )}
                {linhas.length > 1 && (
                  <Button variant="secondary" onClick={() => tirar(linha.chave)}>
                    Tirar esta espécie
                  </Button>
                )}
              </fieldset>
            );
          })}

          <Button
            variant="outline"
            onClick={() =>
              setLinhas((atuais) => [...atuais, linhaNova(item, aberta, Math.max(0, ...atuais.map((l) => l.chave)) + 1)])
            }
          >
            Mais uma espécie
          </Button>

          <div className="sticky bottom-0 flex flex-col gap-2 rounded-lg border border-line bg-white p-3 shadow-sm">
            <p className={`text-base font-bold ${completo ? 'text-green-800' : 'text-amber-900'}`} aria-live="polite">
              {contador}
            </p>
            {escolheuAlguma && falha && <p className="text-sm text-amber-900">{falha}</p>}
          </div>

          {state.error && <Notice tone="error">{state.error}</Notice>}
        </div>
      )}

      <CampoObservacao
        valor={observacao}
        onChange={setObservacao}
        onBlur={() => {
          // A observação vai junto da resposta: com resposta gravada, regrava a mesma
          if (gravada === 'nao_tem') gravarNaoTem();
          else if (aberta && gravada === aberta) enviar(aberta, linhas);
        }}
      />

      {estadoNaoTem.error && <Notice tone="error">{estadoNaoTem.error}</Notice>}
    </li>
  );
}
