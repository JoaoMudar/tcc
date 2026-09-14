'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { NENHUM } from '@/lib/agenda-rotulos';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import type { Declaracoes } from '@/lib/tipos-tarefa';
import { Interruptor } from '../../cadastros/tipos-tarefa/Interruptor';
import { type AreaOpcao, AreaCanteiroOpcional } from './AreaCanteiroOpcional';
import { EscolhaMultipla } from './EscolhaMultipla';
import { atualizarAtribuicaoAction, criarAtribuicaoAction } from './actions';

export interface TipoOpcao extends Declaracoes {
  id: string;
  nome: string;
}

export interface OpcoesAtribuicao {
  funcionarios: readonly SelectOption[];
  tipos: readonly TipoOpcao[];
  turnos: readonly SelectOption[];
  dias: readonly SelectOption[];
  lotes: readonly SelectOption[];
  especies: readonly SelectOption[];
  recipientes: readonly SelectOption[];
  areas: readonly AreaOpcao[];
}

interface AtribuicaoFormProps {
  semana: string;
  opcoes: OpcoesAtribuicao;
  /** Valores de partida, com os mesmos nomes dos campos; listas separadas por vírgula. */
  inicial: Readonly<Record<string, string>>;
  /** Presente na alteração: um dia só, e a mesma tarefa. */
  atribuicaoId?: string;
}

function comNenhum(opcoes: readonly SelectOption[], rotulo: string): SelectOption[] {
  return [{ value: NENHUM, label: rotulo }, ...opcoes];
}

/**
 * T5.2, RF-21, RF-26: pessoas, tipo, dia e turno. O resto aparece conforme o
 * tipo de tarefa declarar, e a hora só na tarefa que tem hora marcada (RN-12).
 */
export function AtribuicaoForm({ semana, opcoes, inicial, atribuicaoId }: AtribuicaoFormProps) {
  const editando = atribuicaoId !== undefined;
  const [state, formAction, pending] = useActionState(editando ? atualizarAtribuicaoAction : criarAtribuicaoAction, EMPTY_FORM_STATE);
  const valores = state.error && state.fields ? state.fields : inicial;
  const [tipoId, setTipoId] = useState(valores.tipo_tarefa_id ?? '');
  const [temHora, setTemHora] = useState(Boolean(valores.hora_inicio));
  const tipo = opcoes.tipos.find((t) => t.id === tipoId);
  const lista = (nome: string) => new Set((valores[nome] ?? '').split(',').filter(Boolean));

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="semana" value={semana} />
      {editando && <input type="hidden" name="id" value={atribuicaoId} />}

      <EscolhaMultipla legenda="Quem vai fazer" name="participantes" opcoes={opcoes.funcionarios} marcados={lista('participantes')} />
      <SelectField
        label="Tarefa"
        name="tipo_tarefa_id"
        options={opcoes.tipos.map((t) => ({ value: t.id, label: t.nome }))}
        defaultValue={valores.tipo_tarefa_id}
        onChange={(event) => setTipoId(event.target.value)}
        required
      />
      <EscolhaMultipla
        legenda={editando ? 'Dia' : 'Dias'}
        name="dias"
        tipo={editando ? 'radio' : 'checkbox'}
        colunas={3}
        opcoes={opcoes.dias}
        marcados={lista('dias')}
      />
      <EscolhaMultipla legenda="Turno" name="turno_id" tipo="radio" opcoes={opcoes.turnos} marcados={lista('turno_id')} />

      <Interruptor
        name="tem_hora"
        label="Tem hora marcada"
        checked={temHora}
        onChange={(event) => setTemHora(event.target.checked)}
      />
      {temHora && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Início" name="hora_inicio" type="time" defaultValue={valores.hora_inicio} required />
          <TextField label="Fim (opcional)" name="hora_fim" type="time" defaultValue={valores.hora_fim} />
        </div>
      )}

      {tipo?.exigeLote && (
        <SelectField
          label="Lote"
          name="lote_id"
          options={comNenhum(opcoes.lotes, 'Escolher na confirmação')}
          defaultValue={valores.lote_id || NENHUM}
        />
      )}
      {tipo?.exigeEspecie && (
        <SelectField label="Espécie" name="especie_id" options={comNenhum(opcoes.especies, 'Ainda não sei')} defaultValue={valores.especie_id || NENHUM} />
      )}
      {tipo?.exigeRecipiente && (
        <SelectField
          label="Recipiente"
          name="recipiente_id"
          options={comNenhum(opcoes.recipientes, 'Ainda não sei')}
          defaultValue={valores.recipiente_id || NENHUM}
        />
      )}
      {tipo && !tipo.exigeLote && (
        <AreaCanteiroOpcional areas={opcoes.areas} defaultAreaId={valores.area_id} defaultCanteiroId={valores.canteiro_id} />
      )}
      {tipo?.eQuantitativa && (
        <TextField
          label="Quantidade prevista (opcional)"
          name="quantidade_planejada"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={valores.quantidade_planejada}
        />
      )}

      <Interruptor name="recorrente" label="Repete toda semana" defaultChecked={valores.recorrente === 'on'} />
      <TextField label="Observação (opcional)" name="observacoes" maxLength={500} defaultValue={valores.observacoes} />

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" pending={pending}>
        {editando ? 'Salvar alteração' : 'Lançar tarefa'}
      </Button>
    </form>
  );
}
