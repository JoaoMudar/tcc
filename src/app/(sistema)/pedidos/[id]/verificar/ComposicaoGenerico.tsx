'use client';

import { startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import {
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

function resumoDoGenerico(item: GenericoParaCompor, gravada: EstadoDaResposta, rotuloTudo: string): string {
  if (gravada === 'nao_tem') return 'Não tem no viveiro';
  const especies = item.filhos.length === 1 ? '1 espécie' : `${item.filhos.length} espécies`;
  if (gravada === 'tudo') return `${rotuloTudo}: ${especies}`;
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
 * conta. O botão de gravar só habilita quando a regra fecha, e a regra é a
 * mesma do servidor (`validarComposicaoGenerico`).
 */
export function ComposicaoGenerico({ pedidoId, item, especies, recipientes }: ComposicaoGenericoProps) {
  const [state, formAction, pending] = useActionState(definirComposicaoAction, EMPTY_FORM_STATE);
  const [estadoNaoTem, naoTemAction, gravandoNaoTem] = useActionState(marcarGenericoIndisponivelAction, EMPTY_FORM_STATE);
  const gravada = estadoDoGenerico(item, item.filhos);
  const perguntas = perguntasDoItem(item, true);

  const [aberta, setAberta] = useState<Modo | null>(gravada === 'parte' || gravada === 'tudo' ? gravada : null);
  const [linhas, setLinhas] = useState<Linha[]>(() => (aberta ? linhasIniciais(item, aberta, gravada) : []));
  const [observacao, setObservacao] = useState(item.observacoesDisponibilidade ?? '');

  function gravarNaoTem() {
    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    dados.set('item_pai_id', item.id);
    dados.set('observacoes', observacao);
    startTransition(() => naoTemAction(dados));
  }

  function escolher(resposta: Resposta) {
    if (resposta === 'nao_tem') {
      setAberta(null);
      gravarNaoTem();
      return;
    }
    setAberta(resposta);
    setLinhas(linhasIniciais(item, resposta, gravada));
  }

  const alterar = (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string) =>
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, [campo]: valor } : linha)));

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
  const falha = 'error' in lidas ? lidas.error : validada && 'error' in validada ? validada.error : null;

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

  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${COR_DO_ESTADO[gravada]}`}>
      <CabecalhoItem
        sobretitulo="Sem espécie definida"
        titulo={rotuloGenerico(item.especificacao)}
        quantidade={item.quantidade}
        recipiente={item.recipiente}
        alturaM={item.alturaM}
        estado={gravada}
        resumo={resumoDoGenerico(item, gravada, perguntas.rotuloTudo)}
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
        selecionada={aberta ?? (gravada === 'pendente' ? null : gravada)}
        pending={pending || gravandoNaoTem}
        onEscolher={escolher}
      />

      {aberta && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="pedido_id" value={pedidoId} />
          <input type="hidden" name="item_pai_id" value={item.id} />
          <input type="hidden" name="estado" value={aberta === 'parte' ? 'parcial' : 'disponivel'} />
          <input type="hidden" name="observacoes" value={observacao} />

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
                  onChange={(valor) => alterar(linha.chave, 'especieId', valor)}
                  required
                />
                {/* As listas vão paralelas: campo que a regra não pergunta vai vazio, e o servidor herda do genérico */}
                {quantidade ? (
                  <TextField
                    label="Quantas"
                    name="composicao_quantidade"
                    inputMode="numeric"
                    autoComplete="off"
                    required={quantidade.obrigatorio}
                    value={linha.quantidade}
                    onChange={(evento) => alterar(linha.chave, 'quantidade', evento.target.value)}
                  />
                ) : (
                  <input type="hidden" name="composicao_quantidade" value="" />
                )}
                {recipiente ? (
                  <SelectField
                    label="Recipiente"
                    name="composicao_recipiente"
                    options={recipientes}
                    required={recipiente.obrigatorio}
                    value={linha.recipienteId}
                    onChange={(evento) => alterar(linha.chave, 'recipienteId', evento.target.value)}
                  />
                ) : (
                  <input type="hidden" name="composicao_recipiente" value="" />
                )}
                {altura ? (
                  <TextField
                    label="Altura"
                    name="composicao_altura"
                    inputMode="decimal"
                    autoComplete="off"
                    required={altura.obrigatorio}
                    value={linha.altura}
                    onChange={(evento) => alterar(linha.chave, 'altura', evento.target.value)}
                  />
                ) : (
                  <input type="hidden" name="composicao_altura" value="" />
                )}
                {linhas.length > 1 && (
                  <Button
                    variant="secondary"
                    onClick={() => setLinhas((atuais) => atuais.filter((atual) => atual.chave !== linha.chave))}
                  >
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
            <Button type="submit" pending={pending} pendingLabel="Gravando…" disabled={!completo}>
              Gravar
            </Button>
          </div>

          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.success && <Notice tone="success">{state.success}</Notice>}
        </form>
      )}

      <CampoObservacao
        valor={observacao}
        onChange={setObservacao}
        onBlur={() => {
          if (gravada === 'nao_tem') gravarNaoTem();
        }}
      />

      {estadoNaoTem.error && <Notice tone="error">{estadoNaoTem.error}</Notice>}
    </li>
  );
}
