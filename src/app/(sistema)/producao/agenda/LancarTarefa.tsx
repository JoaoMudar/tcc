import Link from 'next/link';
import { Notice } from '@/components/ui/Notice';
import { findSemana } from '@/lib/agenda';
import { hojeNoViveiro } from '@/lib/datas';
import pool from '@/lib/db';
import { diasDaSemana, lerSemana, rotuloSemana } from '@/lib/semanas';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { AtribuicaoForm } from './AtribuicaoForm';
import { TelaDeTarefa } from './TelaDeTarefa';
import { carregarOpcoes } from './opcoes';

export interface PedidoDeLancamento {
  semana?: string;
  dia?: string;
  etapa?: string;
  lote?: string;
  tipo?: string;
  turno?: string;
}

/** T5.2, F1 UC-19: lançar tarefa na semana, para um ou vários dias. Em modal sobre a agenda, ou página pelo endereço. */
export async function LancarTarefa({ pedido, emModal }: { pedido: PedidoDeLancamento; emModal: boolean }) {
  await requirePageAccess('agenda', 'C');
  const { semana: semanaPedida, dia, etapa, lote, tipo, turno } = pedido;
  const inicio = lerSemana(semanaPedida, hojeNoViveiro());
  const [semana, opcoes] = await Promise.all([findSemana(pool, inicio), carregarOpcoes(inicio)]);
  const diaInicial = dia && diasDaSemana(inicio).includes(dia) ? dia : '';

  /**
   * RF-47: a sugestão aceita abre este mesmo formulário, já com a etapa, o lote
   * e o tipo preenchidos. O dia, o turno e quem faz continuam sendo exigidos, e
   * o vencimento o servidor lê da etapa, nunca daqui.
   */
  const daSugestao =
    etapa && isUuid(etapa) && lote && isUuid(lote) && tipo && isUuid(tipo)
      ? {
          lote_etapa_id: etapa,
          lote_id: lote,
          tipo_tarefa_id: tipo,
          ...(turno && isUuid(turno) ? { turno_id: turno } : {}),
        }
      : {};

  return (
    <TelaDeTarefa titulo={`Lançar tarefa · ${rotuloSemana(inicio)}`} emModal={emModal} voltar={{ href: `/producao?dia=${diaInicial || inicio}` }}>
      {semana?.situacao === 'fechada' ? (
        <Notice tone="info">Esta semana está fechada e não recebe tarefa nova.</Notice>
      ) : opcoes.faltam.length > 0 ? (
        <Notice tone="info">
          Para lançar tarefa, cadastre antes: {opcoes.faltam.join(', ')}.{' '}
          <Link href="/cadastros" className="font-semibold underline">
            Ir aos cadastros
          </Link>
        </Notice>
      ) : (
        <AtribuicaoForm semana={inicio} opcoes={opcoes} inicial={{ dias: diaInicial, ...daSugestao }} />
      )}
    </TelaDeTarefa>
  );
}
