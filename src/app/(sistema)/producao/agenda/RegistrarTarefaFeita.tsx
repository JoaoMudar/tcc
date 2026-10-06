import Link from 'next/link';
import { Notice } from '@/components/ui/Notice';
import { hojeNoViveiro } from '@/lib/datas';
import { inicioDaSemana } from '@/lib/semanas';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { RegistrarFeitaForm } from './RegistrarFeitaForm';
import { TelaDeTarefa } from './TelaDeTarefa';
import { carregarOpcoes } from './opcoes';

export interface PedidoDeRegistro {
  etapa?: string;
  lote?: string;
  tipo?: string;
  turno?: string;
}

/**
 * RF-66: "Confirmar tarefa" da etapa que pede providência e ninguém lançou. Ela
 * foi feita fora da agenda: registra-se como tarefa confirmada no dia em que foi
 * feita. Em modal sobre a agenda, ou página pelo endereço.
 */
export async function RegistrarTarefaFeita({ pedido, emModal }: { pedido: PedidoDeRegistro; emModal: boolean }) {
  await requirePageAccess('agenda', 'C');
  await requirePageAccess('confirmacao_tarefa', 'C');
  const hoje = hojeNoViveiro();
  const etapa = pedido.etapa && isUuid(pedido.etapa) ? pedido.etapa : null;
  const lote = pedido.lote && isUuid(pedido.lote) ? pedido.lote : null;
  const turno = pedido.turno && isUuid(pedido.turno) ? pedido.turno : '';
  const opcoes = etapa && lote ? await carregarOpcoes(inicioDaSemana(hoje)) : null;
  const tipo = opcoes?.tipos.find((t) => t.id === pedido.tipo);
  const loteRotulo = opcoes?.lotes.find((l) => l.value === lote)?.label;

  return (
    <TelaDeTarefa titulo="Confirmar tarefa feita" emModal={emModal} voltar={{ href: `/producao?dia=${hoje}` }}>
      {!etapa || !lote || !opcoes || !tipo || !loteRotulo ? (
        <Notice tone="info">Esta pendência não existe mais.</Notice>
      ) : opcoes.faltam.length > 0 ? (
        <Notice tone="info">
          Para confirmar tarefa, cadastre antes: {opcoes.faltam.join(', ')}.{' '}
          <Link href="/cadastros" className="font-semibold underline">
            Ir aos cadastros
          </Link>
        </Notice>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-white p-4 text-base">
            <div>
              <dt className="text-sm text-muted">Tarefa</dt>
              <dd className="font-semibold text-ink">{tipo.nome}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Lote</dt>
              <dd className="font-semibold text-ink">{loteRotulo}</dd>
            </div>
          </dl>
          <RegistrarFeitaForm
            etapaId={etapa}
            loteId={lote}
            tipoTarefaId={tipo.id}
            eQuantitativa={tipo.eQuantitativa}
            unidadeMedida={tipo.unidadeMedida}
            funcionarios={opcoes.funcionarios}
            turnos={opcoes.turnos}
            turnoId={turno}
            hoje={hoje}
          />
        </>
      )}
    </TelaDeTarefa>
  );
}
