'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import {
  type EstadoDaResposta,
  type EstadoDisponibilidade,
  type Pergunta,
  alturaParaCampo,
  estadoDaResposta,
  formatAltura,
  normalizaCampoAltura,
  parseAltura,
  perguntasDoItem,
  resolveDisponibilidade,
} from '@/lib/pedidos-rotulos';
import { marcarDisponibilidadeAction } from './actions';
import { BotoesResposta, type Resposta } from './BotoesResposta';
import { COR_DO_ESTADO, CabecalhoItem } from './CabecalhoItem';
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
}

interface VerificacaoItemProps {
  pedidoId: string;
  item: ItemParaConferir;
  recipientes: readonly SelectOption[];
}

interface Campos {
  quantidade: string;
  recipienteId: string;
  altura: string;
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

function respostaGravada(gravada: EstadoDaResposta): Resposta | null {
  return gravada === 'pendente' ? null : gravada;
}

/** O que foi respondido, numa linha, para quem passa os olhos pela lista. */
function resumoDaResposta(item: ItemParaConferir, gravada: EstadoDaResposta, rotuloTudo: string): string {
  if (gravada === 'nao_tem') return 'Não tem no viveiro';
  const emRecipiente = item.recipienteDisponivel ? `em ${item.recipienteDisponivel}` : null;
  if (gravada === 'tudo') {
    const contada = item.quantidadeDisponivel ? ` ${formatQuantidade(item.quantidadeDisponivel)}` : '';
    return `${rotuloTudo}${contada}${emRecipiente ? `, ${emRecipiente}` : ''}`;
  }
  const quantas =
    item.quantidadeDisponivel === null
      ? null
      : item.quantidade === null
        ? formatQuantidade(item.quantidadeDisponivel)
        : `${formatQuantidade(item.quantidadeDisponivel)} de ${formatQuantidade(item.quantidade)}`;
  const partes = [quantas, emRecipiente, item.alturaDisponivelM === null ? null : formatAltura(item.alturaDisponivelM)];
  return `Tem parte: ${partes.filter(Boolean).join(', ')}`;
}

/**
 * T8.12, P12: um item com espécie. **Os botões e os campos vêm da regra**
 * (`perguntasDoItem`), e a mesma regra valida antes de enviar
 * (`resolveDisponibilidade`), para o erro aparecer no campo e não depois.
 *
 * Não há "Salvar" por item, de propósito: quem confere está andando no pátio
 * com o celular numa mão. O toque grava quando não há o que perguntar ("Não
 * tem", "Tem tudo" no item completo); com painel, cada campo grava ao sair dele.
 */
export function VerificacaoItem({ pedidoId, item, recipientes }: VerificacaoItemProps) {
  const [state, formAction, pending] = useActionState(marcarDisponibilidadeAction, EMPTY_FORM_STATE);
  const gravada = estadoDaResposta(item);
  const perguntas = perguntasDoItem(item);

  const [aberta, setAberta] = useState<Resposta | null>(() => {
    if (gravada === 'parte') return 'parte';
    return gravada === 'tudo' && perguntas.tudo.length > 0 ? 'tudo' : null;
  });
  const [campos, setCampos] = useState<Campos>(() => (aberta ? camposIniciais(item, aberta, gravada) : VAZIOS));
  const [observacao, setObservacao] = useState(item.observacoesDisponibilidade ?? '');
  const [aviso, setAviso] = useState<string | null>(null);
  // O que já está no banco: sair do campo sem mudar nada não regrava
  const gravado = useRef<string | null>(
    aberta && gravada === aberta ? JSON.stringify([aberta, campos, observacao]) : null,
  );

  function enviar(resposta: Resposta, valores: Campos, opcoes: { silencioso?: boolean } = {}) {
    const estado = ESTADO_DA_RESPOSTA[resposta];
    let valida: string | null = null;
    if (resposta !== 'nao_tem') {
      const texto = valores.quantidade.trim();
      const quantidade = texto === '' ? null : lerQuantidade(texto);
      const altura = parseAltura(valores.altura);
      if (texto !== '' && quantidade === null) valida = 'Informe quantas mudas existem, um número inteiro maior que zero.';
      else if ('error' in altura) valida = altura.error;
      else {
        const resolvida = resolveDisponibilidade(estado, item, {
          quantidade,
          recipienteId: valores.recipienteId || null,
          alturaM: altura.value,
        });
        if ('error' in resolvida) valida = resolvida.error;
      }
    }
    if (valida) {
      if (!opcoes.silencioso) setAviso(valida);
      return;
    }
    setAviso(null);

    const chave = JSON.stringify([resposta, valores, observacao]);
    // Repetir só vale se o banco já tem exatamente isto: depois de erro, vai de novo
    if (chave === gravado.current && !state.error) return;
    gravado.current = chave;

    const dados = new FormData();
    dados.set('pedido_id', pedidoId);
    dados.set('item_id', item.id);
    dados.set('estado', estado);
    dados.set('quantidade', valores.quantidade);
    dados.set('recipiente_id', valores.recipienteId);
    dados.set('altura', valores.altura);
    dados.set('observacoes', observacao);
    startTransition(() => formAction(dados));
  }

  function escolher(resposta: Resposta) {
    setAviso(null);
    const pergunta = resposta === 'parte' ? perguntas.parte : resposta === 'tudo' ? perguntas.tudo : [];
    if (pergunta.length === 0) {
      setAberta(null);
      enviar(resposta, VAZIOS);
      return;
    }
    const iniciais = camposIniciais(item, resposta, gravada);
    setAberta(resposta);
    setCampos(iniciais);
    // "Tem" com pergunta só opcional já é resposta: grava no toque, e o número vem se vier
    if (resposta === 'tudo') enviar(resposta, iniciais, { silencioso: true });
  }

  function alterar(campo: keyof Campos, valor: string, gravar = false) {
    const proximos = { ...campos, [campo]: valor };
    setCampos(proximos);
    if (gravar && aberta) enviar(aberta, proximos);
    return proximos;
  }

  const lista: readonly Pergunta[] = aberta === 'parte' ? perguntas.parte : aberta === 'tudo' ? perguntas.tudo : [];
  const selecionada = aberta ?? respostaGravada(gravada);
  const status = pending
    ? 'Gravando…'
    : aberta && gravada === aberta && !state.error
      ? 'Gravado.'
      : 'Grava ao sair do campo.';

  return (
    <li className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${COR_DO_ESTADO[gravada]}`}>
      <CabecalhoItem
        titulo={item.especie}
        quantidade={item.quantidade}
        recipiente={item.recipiente}
        alturaM={item.alturaM}
        estado={gravada}
        resumo={resumoDaResposta(item, gravada, perguntas.rotuloTudo)}
      />

      <BotoesResposta perguntas={perguntas} selecionada={selecionada} pending={pending} onEscolher={escolher} />

      {aberta && (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-3">
          {lista.map((pergunta) => {
            if (pergunta.campo === 'quantidade') {
              return (
                <TextField
                  key="quantidade"
                  label="Quantas tem"
                  name="quantidade"
                  inputMode="numeric"
                  autoComplete="off"
                  required={pergunta.obrigatorio}
                  hint={
                    item.quantidade === null
                      ? 'Se não contou, deixe em branco.'
                      : `Pedido: ${formatQuantidade(item.quantidade)}`
                  }
                  value={campos.quantidade}
                  onChange={(evento) => alterar('quantidade', evento.target.value)}
                  onBlur={() => enviar(aberta, campos)}
                />
              );
            }
            if (pergunta.campo === 'recipiente') {
              return (
                // Pode ser outro recipiente: achou em saco o que foi pedido em tubete
                <SelectField
                  key="recipiente"
                  label="Em que recipiente está"
                  name="recipiente_id"
                  required={pergunta.obrigatorio}
                  options={recipientes}
                  value={campos.recipienteId}
                  onChange={(evento) => alterar('recipienteId', evento.target.value, true)}
                />
              );
            }
            return (
              <TextField
                key="altura"
                label="Com que altura"
                name="altura"
                inputMode="decimal"
                autoComplete="off"
                required={pergunta.obrigatorio}
                hint={item.alturaM === null ? undefined : `Pedido: ${formatAltura(item.alturaM)}`}
                value={campos.altura}
                onChange={(evento) => alterar('altura', evento.target.value)}
                onBlur={() => {
                  const normalizada = normalizaCampoAltura(campos.altura);
                  enviar(aberta, alterar('altura', normalizada === '' ? '' : normalizada.replace(/\s*m$/, '')));
                }}
              />
            );
          })}
          <p className={`text-sm ${aviso ? 'font-semibold text-amber-900' : 'text-muted'}`} aria-live="polite">
            {aviso ?? status}
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
          enviar(resposta, aberta === resposta ? campos : camposIniciais(item, resposta, gravada));
        }}
      />

      {state.error && <Notice tone="error">{state.error}</Notice>}
    </li>
  );
}
