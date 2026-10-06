import { notFound } from 'next/navigation';
import { Notice } from '@/components/ui/Notice';
import { NENHUM, findAtribuicao } from '@/lib/agenda';
import pool from '@/lib/db';
import { isDataIso } from '@/lib/datas';
import { inicioDaSemana } from '@/lib/semanas';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { AtribuicaoForm } from './AtribuicaoForm';
import { TelaDeTarefa } from './TelaDeTarefa';
import { carregarOpcoes } from './opcoes';

/**
 * Alterar a tarefa ainda planejada: em modal sobre a agenda, ou página pelo
 * endereço. Fica na semana dela, salvo quando `semana` pede uma à frente: é o
 * "Marcar na agenda" da tarefa atrasada (RF-66), e aí o dia vem em branco.
 * Esse caminho traz `voltar=agenda`: salva, volta para a agenda, não para a ficha.
 */
export async function EditarTarefa({
  id,
  semana,
  voltar,
  emModal,
}: {
  id: string;
  semana?: string;
  voltar?: string;
  emModal: boolean;
}) {
  await requirePageAccess('agenda', 'A');
  if (!isUuid(id)) notFound();
  const a = await findAtribuicao(pool, id);
  if (!a) notFound();
  const pedida = semana && isDataIso(semana) ? inicioDaSemana(semana) : a.semanaInicio;
  const destino = pedida > a.semanaInicio ? pedida : a.semanaInicio;
  const movendo = destino !== a.semanaInicio;
  const editavel = a.situacao === 'planejada' && a.semanaSituacao !== 'fechada';
  const opcoes = editavel ? await carregarOpcoes(destino) : null;

  return (
    <TelaDeTarefa titulo={`Alterar · ${a.tipo}`} emModal={emModal} voltar={{ href: `/producao/agenda/${a.id}` }}>
      {!opcoes ? (
        <Notice tone="info">Só a tarefa planejada, numa semana ainda aberta, pode ser alterada.</Notice>
      ) : (
        <>
          <AtribuicaoForm
            semana={destino}
            opcoes={opcoes}
            atribuicaoId={a.id}
            voltarParaAgenda={voltar === 'agenda'}
            inicial={{
              dias: movendo ? '' : a.data,
              turno_id: a.turnoId,
              tipo_tarefa_id: a.tipoTarefaId,
              hora_inicio: a.horaInicio ?? '',
              hora_fim: a.horaFim ?? '',
              participantes: a.participantes.map((p) => p.id).join(','),
              lote_id: a.loteId ?? NENHUM,
              especie_id: a.especieId ?? NENHUM,
              recipiente_id: a.recipienteId ?? NENHUM,
              area_id: a.areaId ?? '',
              canteiro_id: a.canteiroId ?? '',
              quantidade_planejada: a.quantidadePlanejada === null ? '' : String(a.quantidadePlanejada),
              recorrente: a.eRecorrente ? 'on' : '',
              observacoes: a.observacoes ?? '',
            }}
          />
        </>
      )}
    </TelaDeTarefa>
  );
}
