'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import { toUserMessage } from '@/lib/errors';
import { type FormState, formText } from '@/lib/form-state';
import * as protocolos from '@/lib/protocolos';
import { isUuid } from '@/lib/uuid';
import { requirePermission } from '@/lib/auth/guards';

/** RF-22, UC-17: cria (sem `protocolo_id`) ou altera o protocolo do recipiente. */
export async function saveProtocolo(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = formText(formData, 'protocolo_id');
  const user = await requirePermission('protocolos', id ? 'A' : 'C');
  if (id && !isUuid(id)) return { error: 'Protocolo inválido.' };

  const fields = {
    recipiente_id: formText(formData, 'recipiente_id'),
    nome: formText(formData, 'nome'),
    observacoes: formText(formData, 'observacoes'),
  };
  if (!id && !isUuid(fields.recipiente_id)) return { error: 'Escolha o recipiente que o protocolo rege.', fields };

  const parsed = protocolos.parseProtocoloFields({
    recipienteId: fields.recipiente_id,
    nome: fields.nome,
    observacoes: fields.observacoes,
  });
  if ('error' in parsed) return { error: parsed.error, fields };

  let novoId: string;
  try {
    if (id) {
      const result = await protocolos.updateProtocolo(pool, id, {
        nome: parsed.value.nome,
        observacoes: parsed.value.observacoes,
        ativo: formData.get('ativo') === 'on',
      });
      if (result === 'nao_encontrado') return { error: 'Protocolo não encontrado.', fields };
      novoId = id;
    } else {
      novoId = await protocolos.insertProtocolo(pool, parsed.value, user.usuarioId);
    }
  } catch (error) {
    return { error: protocolos.duplicateMessage(error) ?? toUserMessage(error), fields };
  }

  revalidatePath('/cadastros/protocolos');
  if (!id) redirect(`/cadastros/protocolos/${novoId}?salvo=1`);
  revalidatePath(`/cadastros/protocolos/${id}`);
  return { success: 'Protocolo salvo.' };
}

/**
 * RF-22 a RF-24, UC-17: a etapa do protocolo. A âncora circular (FE-1) é
 * conferida aqui, e não no banco: a restrição não cabe em verificação
 * declarativa, e sem esta barreira as etapas do ciclo nunca venceriam nada, em
 * silêncio.
 */
export async function saveEtapa(_previous: FormState, formData: FormData): Promise<FormState> {
  const etapaId = formText(formData, 'etapa_id');
  await requirePermission('protocolos', etapaId ? 'A' : 'C');

  const protocoloId = formText(formData, 'protocolo_id');
  if (!isUuid(protocoloId)) return { error: 'Protocolo inválido.' };
  if (etapaId && !isUuid(etapaId)) return { error: 'Etapa inválida.' };

  const fields = {
    tipo_tarefa_id: formText(formData, 'tipo_tarefa_id'),
    rotulo: formText(formData, 'rotulo'),
    tipo_agendamento: formText(formData, 'tipo_agendamento'),
    tipo_ancora: formText(formData, 'tipo_ancora'),
    etapa_ancora_id: formText(formData, 'etapa_ancora_id'),
    dias: formText(formData, 'dias'),
    intervalo_dias: formText(formData, 'intervalo_dias'),
    turno_id: formText(formData, 'turno_id'),
    janela_aviso_pct: formText(formData, 'janela_aviso_pct'),
    fase_resultante: formText(formData, 'fase_resultante'),
  };
  const parsed = protocolos.parseEtapaFields({
    tipoTarefaId: fields.tipo_tarefa_id,
    rotulo: fields.rotulo,
    tipoAgendamento: fields.tipo_agendamento,
    tipoAncora: fields.tipo_ancora,
    etapaAncoraId: fields.etapa_ancora_id,
    dias: fields.dias,
    intervaloDias: fields.intervalo_dias,
    turnoId: fields.turno_id,
    alertaLigado: formData.get('alerta_ligado') === 'on',
    janelaAvisoPct: fields.janela_aviso_pct,
    faseResultante: fields.fase_resultante,
  });
  if ('error' in parsed) return { error: parsed.error, fields };

  try {
    const existentes = await protocolos.listEtapas(pool, protocoloId);
    const ciclo = protocolos.detectaCicloDeAncoras(existentes, {
      id: etapaId || null,
      rotulo: parsed.value.rotulo,
      etapaAncoraId: parsed.value.etapaAncoraId,
    });
    if (ciclo) {
      return { error: `Esta âncora forma um ciclo: ${ciclo.join(' → ')}. Nenhuma das etapas venceria.`, fields };
    }

    if (etapaId) {
      const result = await protocolos.updateEtapa(pool, etapaId, {
        ...parsed.value,
        ativo: formData.get('ativo') === 'on',
      });
      if (result === 'nao_encontrado') return { error: 'Etapa não encontrada.', fields };
    } else {
      await protocolos.insertEtapa(pool, protocoloId, parsed.value);
    }
  } catch (error) {
    return { error: protocolos.duplicateMessage(error) ?? toUserMessage(error), fields };
  }

  revalidatePath(`/cadastros/protocolos/${protocoloId}`);
  return { success: etapaId ? 'Etapa salva.' : `Etapa ${parsed.value.rotulo} acrescentada.` };
}
