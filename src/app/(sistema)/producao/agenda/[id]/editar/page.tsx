import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { NENHUM, findAtribuicao } from '@/lib/agenda';
import pool from '@/lib/db';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { AtribuicaoForm } from '../../AtribuicaoForm';
import { carregarOpcoes } from '../../opcoes';

/** Alterar a tarefa ainda planejada, dentro da mesma semana. */
export default async function EditarAtribuicaoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess('agenda', 'A');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const a = await findAtribuicao(pool, id);
  if (!a) notFound();
  const editavel = a.situacao === 'planejada' && a.semanaSituacao !== 'fechada';
  const opcoes = editavel ? await carregarOpcoes(a.semanaInicio) : null;

  return (
    <main>
      <PageHeader area="2 · Produção" title={`Alterar · ${a.tipo}`} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href={`/producao/agenda/${a.id}`} className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {!opcoes ? (
          <Notice tone="info">Só a tarefa planejada, numa semana ainda aberta, pode ser alterada.</Notice>
        ) : (
          <AtribuicaoForm
            semana={a.semanaInicio}
            opcoes={opcoes}
            atribuicaoId={a.id}
            inicial={{
              dias: a.data,
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
        )}
      </div>
    </main>
  );
}
