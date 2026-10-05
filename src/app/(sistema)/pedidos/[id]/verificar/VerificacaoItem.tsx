'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import type { SelectOption } from '@/components/ui/SelectField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import {
  NADA_DIFERE,
  type EstadoDaResposta,
  type EstadoDisponibilidade,
  type Pergunta,
  alturaParaCampo,
  estadoComComplementos,
  formatAltura,
  parseAltura,
  perguntasDoItem,
  resolveResposta,
} from '@/lib/pedidos-rotulos';
import { marcarDisponibilidadeAction } from './actions';
import { BotoesResposta, type Resposta } from './BotoesResposta';
import { COR_DO_ESTADO, CabecalhoItem } from './CabecalhoItem';
import { type Campos, CamposConferidos } from './CamposConferidos';
import { CampoObservacao } from './CampoObservacao';

export interface ItemParaConferir {
  id: string;
  especie: string;
  /** Nulo quando o cliente não disse o tamanho: a resposta diz em qual está. */
  recipiente: string | null;
  recipienteId: string | null;
  /** Altura pedida, em metros. Nula é "o cliente não pediu altura". */
  alturaM: number | null;
  /** Nula quando o cliente não disse quantas. */
  quantidade: number | null;
  disponivel: boolean | null;
  quantidadeDisponivel: number | null;
  recipienteDisponivelId: string | null;
  recipienteDisponivel: string | null;
  alturaDisponivelM: number | null;
  observacoesDisponibilidade: string | null;
  /**
   * P13, P17: os itens que completam este em outros recipientes, gravados com
   * "Tem parte" ou com "Tem tudo" dividido.
   */
  complementos: {
    quantidade: number | null;
    recipienteId: string | null;
    recipiente: string | null;
    alturaM: number | null;
  }[];
}

interface VerificacaoItemProps {
  pedidoId: string;
  item: ItemParaConferir;
  recipientes: readonly SelectOption[];
}

const VAZIOS: Campos = { quantidade: '', recipienteId: '', altura: '' };

const ESTADO_DA_RESPOSTA: Record<Resposta, EstadoDisponibilidade> = {
  nao_tem: 'indisponivel',
  parte: 'parcial',
  tudo: 'disponivel',
};

/**
 * O painel abre preenchido. **Em "Tem parte", com o pedido**: a pessoa troca só
 * o que difere. Reabrindo a resposta já gravada, com o que foi gravado.
 */
function camposIniciais(item: ItemParaConferir, resposta: Resposta, gravada: EstadoDaResposta): Campos {
  const mesma = gravada === resposta;
  const contada = mesma && item.quantidadeDisponivel !== null ? String(item.quantidadeDisponivel) : null;
  if (resposta === 'parte') {
    return {
      quantidade: contada ?? (item.quantidade === null ? '' : String(item.quantidade)),
      recipienteId: (mesma && item.recipienteDisponivelId) || item.recipienteId || '',
      altura: alturaParaCampo(mesma ? (item.alturaDisponivelM ?? item.alturaM) : item.alturaM),
    };
  }
  return { quantidade: contada ?? '', recipienteId: (mesma && item.recipienteDisponivelId) || '', altura: '' };
}

/** Os complementos gravados voltam abertos quando a pessoa reabre a mesma resposta. */
function complementosIniciais(item: ItemParaConferir, resposta: Resposta | null, gravada: EstadoDaResposta): Campos[] {
  if (resposta === null || resposta === 'nao_tem' || resposta !== gravada) return [];
  return item.complementos.map((linha) => ({
    quantidade: linha.quantidade === null ? '' : String(linha.quantidade),
    recipienteId: linha.recipienteId ?? '',
    altura: alturaParaCampo(linha.alturaM),
  }));
}

/** "Tem tudo" dividido pergunta, em cada linha, quantas e em que recipiente. */
const PERGUNTAS_DA_DIVISAO: readonly Pergunta[] = [
  { campo: 'quantidade', obrigatorio: true },
  { campo: 'recipiente', obrigatorio: true },
];

function emLinha(quantidade: number | null, recipiente: string | null, alturaM: number | null): string {
  return [
    quantidade === null ? null : formatQuantidade(quantidade),
    recipiente ? `em ${recipiente}` : null,
    alturaM === null ? null : formatAltura(alturaM),
  ]
    .filter(Boolean)
    .join(', ');
}

function respostaGravada(gravada: EstadoDaResposta): Resposta | null {
  return gravada === 'pendente' ? null : gravada;
}

/**
 * O que foi respondido, numa linha, para quem passa os olhos pela lista. **Só
 * em "Tem parte"**: "Não tem" e "Tem tudo" o botão cheio já diz, e a parte é a
 * única resposta que tem número e recipiente que nenhum botão mostra.
 */
function resumoDaResposta(item: ItemParaConferir, gravada: EstadoDaResposta): string | undefined {
  const outras = item.complementos.map((linha) => ` + ${emLinha(linha.quantidade, linha.recipiente, linha.alturaM)}`).join('');
  // "Tem tudo" dividido: o botão cheio não diz em quais recipientes
  if (gravada === 'tudo' && item.complementos.length > 0) {
    return `Tem tudo: ${emLinha(item.quantidadeDisponivel, item.recipienteDisponivel, null)}${outras}`;
  }
  if (gravada !== 'parte') return undefined;
  const emRecipiente = item.recipienteDisponivel ? `em ${item.recipienteDisponivel}` : null;
  const quantas =
    item.quantidadeDisponivel === null
      ? null
      : item.quantidade === null
        ? formatQuantidade(item.quantidadeDisponivel)
        : `${formatQuantidade(item.quantidadeDisponivel)} de ${formatQuantidade(item.quantidade)}`;
  const partes = [quantas, emRecipiente, item.alturaDisponivelM === null ? null : formatAltura(item.alturaDisponivelM)];
  return `Tem parte: ${partes.filter(Boolean).join(', ')}${outras}`;
}

/** O que o campo diz, como número: vazio é nulo, e o que não se entende é erro. */
function lerCampos(valores: Campos): { error: string } | { value: { quantidade: number | null; alturaM: number | null } } {
  const texto = valores.quantidade.trim();
  const quantidade = texto === '' ? null : lerQuantidade(texto);
  if (texto !== '' && quantidade === null) return { error: 'Informe quantas mudas existem, um número inteiro maior que zero.' };
  const altura = parseAltura(valores.altura);
  if ('error' in altura) return { error: altura.error };
  return { value: { quantidade, alturaM: altura.value } };
}

/**
 * T8.12, P12: um item com espécie. **Os botões e os campos vêm da regra**
 * (`perguntasDoItem`), e a mesma regra valida antes de enviar
 * (`resolveDisponibilidade`), para o erro aparecer no campo e não depois.
 *
 * Não há "Salvar" por item, de propósito: quem confere está andando no pátio
 * com o celular numa mão. O toque grava quando não há o que perguntar ("Não
 * tem", "Tem tudo" no item completo); com painel, cada campo grava ao sair dele.
 *
 * P13: **o cartão pinta no toque**, e "Tem parte" tem o "+", que abre uma
 * linha para completar o pedido em outro recipiente.
 *
 * P17: o "+" abre quantas linhas a pessoa quiser, e aparece também em "Tem
 * tudo" quando o cliente não disse o recipiente: as 50 podem estar 20 num saco
 * e 30 noutro.
 */
export function VerificacaoItem({ pedidoId, item, recipientes }: VerificacaoItemProps) {
  const [state, formAction, pending] = useActionState(marcarDisponibilidadeAction, EMPTY_FORM_STATE);
  const gravada = estadoComComplementos(item, item.complementos);
  const perguntas = perguntasDoItem(item);

  const [aberta, setAberta] = useState<Resposta | null>(() => {
    if (gravada === 'parte') return 'parte';
    return gravada === 'tudo' && perguntas.tudo.length > 0 ? 'tudo' : null;
  });
  // O último botão tocado: "Não tem" não abre painel, e o cartão tem de pintar mesmo assim
  const [tocada, setTocada] = useState<Resposta | null>(null);
  const [campos, setCampos] = useState<Campos>(() => (aberta ? camposIniciais(item, aberta, gravada) : VAZIOS));
  const [complementos, setComplementos] = useState<Campos[]>(() => complementosIniciais(item, aberta, gravada));
  const [observacao, setObservacao] = useState(item.observacoesDisponibilidade ?? '');
  const [aviso, setAviso] = useState<string | null>(null);
  // O que já está no banco: sair do campo sem mudar nada não regrava
  const gravado = useRef<string | null>(
    aberta && gravada === aberta ? JSON.stringify([aberta, campos, complementos, observacao]) : null,
  );

  function validar(resposta: Resposta, valores: Campos, extras: readonly Campos[]): string | null {
    if (resposta === 'nao_tem') return null;
    const lidos = lerCampos(valores);
    if ('error' in lidos) return lidos.error;
    const linhas = [];
    for (const extra of extras) {
      const lido = lerCampos(extra);
      if ('error' in lido) return `No complemento: ${lido.error.toLowerCase()}`;
      linhas.push({ ...lido.value, recipienteId: extra.recipienteId || null });
    }
    const principal = { ...lidos.value, recipienteId: valores.recipienteId || null };
    const resolvida = resolveResposta(ESTADO_DA_RESPOSTA[resposta], item, principal, linhas);
    return 'error' in resolvida ? resolvida.error : null;
  }

  function enviar(resposta: Resposta, valores: Campos, extras: readonly Campos[], opcoes: { silencioso?: boolean } = {}) {
    // "Não tem" não se completa
    const linhas = resposta === 'nao_tem' ? [] : extras;
    const valida = validar(resposta, valores, linhas);
    if (valida) {
      // "Nada difere" não vira aviso: o painel abre igual ao pedido, e a frase aparecia antes de a pessoa mexer
      if (!opcoes.silencioso && valida !== NADA_DIFERE) setAviso(valida);
      return;
    }
    setAviso(null);

    const chave = JSON.stringify([resposta, valores, linhas, observacao]);
    // Repetir só vale se o banco já tem exatamente isto: depois de erro, vai de novo
    if (chave === gravado.current && !state.error) return;
    gravado.current = chave;

    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    dados.set('item_id', item.id);
    dados.set('estado', ESTADO_DA_RESPOSTA[resposta]);
    dados.set('quantidade', valores.quantidade);
    dados.set('recipiente_id', valores.recipienteId);
    dados.set('altura', valores.altura);
    linhas.forEach((linha, n) => {
      dados.set(`complemento_${n}_quantidade`, linha.quantidade);
      dados.set(`complemento_${n}_recipiente_id`, linha.recipienteId);
      dados.set(`complemento_${n}_altura`, linha.altura);
    });
    dados.set('observacoes', observacao);
    startTransition(() => formAction(dados));
  }

  function escolher(resposta: Resposta) {
    setAviso(null);
    setTocada(resposta);
    const pergunta = resposta === 'parte' ? perguntas.parte : resposta === 'tudo' ? perguntas.tudo : [];
    if (pergunta.length === 0) {
      setAberta(null);
      setComplementos([]);
      enviar(resposta, VAZIOS, []);
      return;
    }
    const iniciais = camposIniciais(item, resposta, gravada);
    const extras = complementosIniciais(item, resposta, gravada);
    setAberta(resposta);
    setCampos(iniciais);
    setComplementos(extras);
    // "Tem" com pergunta só opcional já é resposta: grava no toque, e o número vem se vier
    if (resposta === 'tudo') enviar(resposta, iniciais, extras, { silencioso: true });
  }

  function alterar(campo: keyof Campos, valor: string, gravar = false) {
    const proximos = { ...campos, [campo]: valor };
    setCampos(proximos);
    if (gravar && aberta) enviar(aberta, proximos, complementos);
  }

  function alterarComplemento(indice: number, campo: keyof Campos, valor: string, gravar = false) {
    const proximos = complementos.map((linha, n) => (n === indice ? { ...linha, [campo]: valor } : linha));
    setComplementos(proximos);
    if (gravar && aberta) enviar(aberta, campos, proximos);
  }

  function abrirComplemento() {
    // Já vem com o que falta para fechar o pedido: a pessoa só escolhe o recipiente
    const contadas = [campos, ...complementos].reduce((total, linha) => total + (lerQuantidade(linha.quantidade.trim()) ?? 0), 0);
    const falta = item.quantidade === null || contadas === 0 ? 0 : item.quantidade - contadas;
    const altura = aberta === 'tudo' ? '' : alturaParaCampo(item.alturaM);
    setComplementos([...complementos, { quantidade: falta > 0 ? String(falta) : '', recipienteId: '', altura }]);
  }

  function tirarComplemento(indice: number) {
    const proximos = complementos.filter((_, n) => n !== indice);
    setComplementos(proximos);
    // "Tem tudo" sem divisão não pergunta quantas: o número que ficou não vale mais
    const valores = aberta === 'tudo' && proximos.length === 0 && item.quantidade !== null ? { ...campos, quantidade: '' } : campos;
    setCampos(valores);
    if (aberta) enviar(aberta, valores, proximos);
  }

  // "Tem tudo" só se divide quando o cliente não disse o recipiente
  const podeDividir = aberta === 'tudo' && item.recipienteId === null;
  const dividida = podeDividir && complementos.length > 0;
  const basicas: readonly Pergunta[] = aberta === 'parte' ? perguntas.parte : aberta === 'tudo' ? perguntas.tudo : [];
  // Dividido, a primeira linha também diz quantas
  const lista = dividida && !basicas.some((p) => p.campo === 'quantidade') ? [PERGUNTAS_DA_DIVISAO[0], ...basicas] : basicas;
  const perguntasDaLinha = aberta === 'tudo' ? PERGUNTAS_DA_DIVISAO : perguntas.parte;
  const selecionada = aberta ?? tocada ?? respostaGravada(gravada);
  // "Tem parte" só se completa com quantidade pedida: sem ela, não há o que falte
  const podeCompletar = (aberta === 'parte' && item.quantidade !== null) || podeDividir;

  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${COR_DO_ESTADO[selecionada ?? 'pendente']}`}>
      <CabecalhoItem
        titulo={item.especie}
        quantidade={item.quantidade}
        recipiente={item.recipiente}
        alturaM={item.alturaM}
        estado={gravada}
        resumo={resumoDaResposta(item, gravada)}
      />

      <BotoesResposta perguntas={perguntas} selecionada={selecionada} pending={pending} onEscolher={escolher} />

      {aberta && (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3">
          <CamposConferidos
            perguntas={lista}
            valores={campos}
            recipientes={recipientes}
            pedido={item}
            onAlterar={alterar}
          />

          {podeCompletar &&
            complementos.map((linha, n) => (
              <fieldset key={n} className="flex flex-col gap-3 rounded-lg border border-line p-3">
                <legend className="px-1 text-sm font-semibold text-muted">
                  {aberta === 'tudo' ? `Outro recipiente ${n + 1}` : `Complemento ${complementos.length > 1 ? n + 1 : ''}`.trim()}
                </legend>
                <CamposConferidos
                  perguntas={perguntasDaLinha}
                  valores={linha}
                  recipientes={recipientes}
                  pedido={item}
                  prefixo={`complemento_${n}_`}
                  onAlterar={(campo, valor, gravar) => alterarComplemento(n, campo, valor, gravar)}
                />
                <Button variant="secondary" onClick={() => tirarComplemento(n)}>
                  {aberta === 'tudo' ? 'Tirar este recipiente' : 'Tirar complemento'}
                </Button>
              </fieldset>
            ))}

          {podeCompletar && (
            <Button variant="outline" onClick={abrirComplemento}>
              {aberta === 'tudo' ? '+ Dividir em outro recipiente' : '+ Completar com outro recipiente'}
            </Button>
          )}

          <p className="text-sm font-semibold text-amber-900 empty:hidden" aria-live="polite">
            {aviso}
          </p>
        </div>
      )}

      <CampoObservacao
        valor={observacao}
        onChange={setObservacao}
        onBlur={() => {
          // A observação vai junto da resposta: com resposta gravada, regrava a mesma
          const resposta = respostaGravada(gravada);
          if (!resposta) return;
          if (aberta === resposta) enviar(resposta, campos, complementos);
          else enviar(resposta, camposIniciais(item, resposta, gravada), complementosIniciais(item, resposta, gravada));
        }}
      />

      {state.error && <Notice tone="error">{state.error}</Notice>}
    </li>
  );
}
