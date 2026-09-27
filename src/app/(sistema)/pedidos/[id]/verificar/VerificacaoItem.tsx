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
  estadoDaResposta,
  formatAltura,
  parseAltura,
  perguntasDoItem,
  resolveComplemento,
  resolveDisponibilidade,
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
  /** P13: o item que completa este em outro recipiente, gravado com "Tem parte". */
  complemento: {
    quantidade: number | null;
    recipienteId: string | null;
    recipiente: string | null;
    alturaM: number | null;
  } | null;
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

/** O complemento gravado volta aberto quando a pessoa reabre o "Tem parte". */
function complementoInicial(item: ItemParaConferir, resposta: Resposta | null, gravada: EstadoDaResposta): Campos | null {
  if (resposta !== 'parte' || gravada !== 'parte' || !item.complemento) return null;
  return {
    quantidade: item.complemento.quantidade === null ? '' : String(item.complemento.quantidade),
    recipienteId: item.complemento.recipienteId ?? '',
    altura: alturaParaCampo(item.complemento.alturaM),
  };
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
  if (gravada !== 'parte') return undefined;
  const emRecipiente = item.recipienteDisponivel ? `em ${item.recipienteDisponivel}` : null;
  const quantas =
    item.quantidadeDisponivel === null
      ? null
      : item.quantidade === null
        ? formatQuantidade(item.quantidadeDisponivel)
        : `${formatQuantidade(item.quantidadeDisponivel)} de ${formatQuantidade(item.quantidade)}`;
  const partes = [quantas, emRecipiente, item.alturaDisponivelM === null ? null : formatAltura(item.alturaDisponivelM)];
  const complemento = item.complemento
    ? ` + ${[
        item.complemento.quantidade === null ? null : formatQuantidade(item.complemento.quantidade),
        item.complemento.recipiente ? `em ${item.complemento.recipiente}` : null,
        item.complemento.alturaM === null ? null : formatAltura(item.complemento.alturaM),
      ]
        .filter(Boolean)
        .join(', ')}`
    : '';
  return `Tem parte: ${partes.filter(Boolean).join(', ')}${complemento}`;
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
 * segunda linha para completar o pedido em outro recipiente.
 */
export function VerificacaoItem({ pedidoId, item, recipientes }: VerificacaoItemProps) {
  const [state, formAction, pending] = useActionState(marcarDisponibilidadeAction, EMPTY_FORM_STATE);
  const gravada = estadoDaResposta(item);
  const perguntas = perguntasDoItem(item);

  const [aberta, setAberta] = useState<Resposta | null>(() => {
    if (gravada === 'parte') return 'parte';
    return gravada === 'tudo' && perguntas.tudo.length > 0 ? 'tudo' : null;
  });
  // O último botão tocado: "Não tem" não abre painel, e o cartão tem de pintar mesmo assim
  const [tocada, setTocada] = useState<Resposta | null>(null);
  const [campos, setCampos] = useState<Campos>(() => (aberta ? camposIniciais(item, aberta, gravada) : VAZIOS));
  const [complemento, setComplemento] = useState<Campos | null>(() => complementoInicial(item, aberta, gravada));
  const [observacao, setObservacao] = useState(item.observacoesDisponibilidade ?? '');
  const [aviso, setAviso] = useState<string | null>(null);
  // O que já está no banco: sair do campo sem mudar nada não regrava
  const gravado = useRef<string | null>(
    aberta && gravada === aberta ? JSON.stringify([aberta, campos, complemento, observacao]) : null,
  );

  function validar(resposta: Resposta, valores: Campos, extra: Campos | null): string | null {
    if (resposta === 'nao_tem') return null;
    const lidos = lerCampos(valores);
    if ('error' in lidos) return lidos.error;
    const principal = { ...lidos.value, recipienteId: valores.recipienteId || null };
    const resolvida = resolveDisponibilidade(ESTADO_DA_RESPOSTA[resposta], item, principal);
    if ('error' in resolvida) return resolvida.error;
    if (!extra) return null;
    const lidoExtra = lerCampos(extra);
    if ('error' in lidoExtra) return `No complemento: ${lidoExtra.error.toLowerCase()}`;
    const resolvido = resolveComplemento(item, principal, { ...lidoExtra.value, recipienteId: extra.recipienteId || null });
    return 'error' in resolvido ? resolvido.error : null;
  }

  function enviar(resposta: Resposta, valores: Campos, extra: Campos | null, opcoes: { silencioso?: boolean } = {}) {
    // Só "Tem parte" se completa
    const comComplemento = resposta === 'parte' ? extra : null;
    const valida = validar(resposta, valores, comComplemento);
    if (valida) {
      // "Nada difere" não vira aviso: o painel abre igual ao pedido, e a frase aparecia antes de a pessoa mexer
      if (!opcoes.silencioso && valida !== NADA_DIFERE) setAviso(valida);
      return;
    }
    setAviso(null);

    const chave = JSON.stringify([resposta, valores, comComplemento, observacao]);
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
    if (comComplemento) {
      dados.set('complemento_quantidade', comComplemento.quantidade);
      dados.set('complemento_recipiente_id', comComplemento.recipienteId);
      dados.set('complemento_altura', comComplemento.altura);
    }
    dados.set('observacoes', observacao);
    startTransition(() => formAction(dados));
  }

  function escolher(resposta: Resposta) {
    setAviso(null);
    setTocada(resposta);
    const pergunta = resposta === 'parte' ? perguntas.parte : resposta === 'tudo' ? perguntas.tudo : [];
    if (pergunta.length === 0) {
      setAberta(null);
      setComplemento(null);
      enviar(resposta, VAZIOS, null);
      return;
    }
    const iniciais = camposIniciais(item, resposta, gravada);
    const extra = complementoInicial(item, resposta, gravada);
    setAberta(resposta);
    setCampos(iniciais);
    setComplemento(extra);
    // "Tem" com pergunta só opcional já é resposta: grava no toque, e o número vem se vier
    if (resposta === 'tudo') enviar(resposta, iniciais, null, { silencioso: true });
  }

  function alterar(campo: keyof Campos, valor: string, gravar = false) {
    const proximos = { ...campos, [campo]: valor };
    setCampos(proximos);
    if (gravar && aberta) enviar(aberta, proximos, complemento);
  }

  function alterarComplemento(campo: keyof Campos, valor: string, gravar = false) {
    if (!complemento) return;
    const proximo = { ...complemento, [campo]: valor };
    setComplemento(proximo);
    if (gravar && aberta) enviar(aberta, campos, proximo);
  }

  function abrirComplemento() {
    // Já vem com o que falta para fechar o pedido: a pessoa só escolhe o recipiente
    const principal = lerQuantidade(campos.quantidade.trim()) ?? 0;
    const falta = item.quantidade === null ? 0 : item.quantidade - principal;
    setComplemento({ quantidade: falta > 0 ? String(falta) : '', recipienteId: '', altura: alturaParaCampo(item.alturaM) });
  }

  function tirarComplemento() {
    setComplemento(null);
    if (aberta) enviar(aberta, campos, null);
  }

  const lista: readonly Pergunta[] = aberta === 'parte' ? perguntas.parte : aberta === 'tudo' ? perguntas.tudo : [];
  const selecionada = aberta ?? tocada ?? respostaGravada(gravada);
  // Completar só faz sentido com quantidade pedida: sem ela, não há o que falte
  const podeCompletar = aberta === 'parte' && item.quantidade !== null;

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

          {podeCompletar && complemento && (
            <fieldset className="flex flex-col gap-3 rounded-lg border border-line p-3">
              <legend className="px-1 text-sm font-semibold text-muted">Complemento</legend>
              <CamposConferidos
                perguntas={perguntas.parte}
                valores={complemento}
                recipientes={recipientes}
                pedido={item}
                prefixo="complemento_"
                onAlterar={alterarComplemento}
              />
              <Button variant="secondary" onClick={tirarComplemento}>
                Tirar complemento
              </Button>
            </fieldset>
          )}

          {podeCompletar && !complemento && (
            <Button variant="outline" onClick={abrirComplemento}>
              + Completar com outro recipiente
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
          if (aberta === resposta) enviar(resposta, campos, complemento);
          else enviar(resposta, camposIniciais(item, resposta, gravada), complementoInicial(item, resposta, gravada));
        }}
      />

      {state.error && <Notice tone="error">{state.error}</Notice>}
    </li>
  );
}
