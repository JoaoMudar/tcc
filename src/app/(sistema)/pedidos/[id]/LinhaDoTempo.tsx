import { hojeNoViveiro } from '@/lib/datas';
import { ROTULO_HISTORICO, type SituacaoPedido } from '@/lib/pedidos-rotulos';

export interface FaseDoPedido {
  situacaoAnterior?: SituacaoPedido | null;
  situacaoNova: SituacaoPedido;
  observacoes?: string | null;
  criadoEm: Date;
}

/**
 * Linha do histórico que não troca a situação: é uma nota, como a entrega
 * marcada no planejamento da viagem (P14). Não é fase, e não leva seta.
 */
export function isNota(fase: FaseDoPedido): boolean {
  return fase.situacaoAnterior === fase.situacaoNova;
}

/** 28/09, no fuso do viveiro: a hora do servidor em UTC viraria o dia seguinte depois das 21h. */
function diaEMes(data: Date): string {
  const [, mes, dia] = hojeNoViveiro(data).split('-');
  return `${dia}/${mes}`;
}

/**
 * Quais fases fazem o pedido andar para trás: voltar para o cadastro (item
 * editado, a conferência recomeça), a chefia pedir alteração e o cancelamento.
 * Todo o resto é o pedido seguindo o caminho.
 */
const RETROCESSOS: ReadonlySet<SituacaoPedido> = new Set(['cadastrado', 'pendente_alteracao', 'cancelado']);

export type SentidoDaFase = 'inicio' | 'avanca' | 'retrocede';

/** A primeira fase não tem de onde vir; as demais avançam ou retrocedem. */
export function sentidoDaFase(situacao: SituacaoPedido, indice: number): SentidoDaFase {
  if (indice === 0) return 'inicio';
  return RETROCESSOS.has(situacao) ? 'retrocede' : 'avanca';
}

const MARCADOR: Record<SentidoDaFase, { simbolo: string; cor: string; rotulo?: string }> = {
  inicio: { simbolo: '•', cor: 'text-muted' },
  avanca: { simbolo: '↑', cor: 'text-feito', rotulo: 'Avançou' },
  retrocede: { simbolo: '↓', cor: 'text-nao-feito', rotulo: 'Retrocedeu' },
};

/**
 * RN-53: o andamento do pedido como ele aconteceu, uma fase por linha
 * (`pedidos_historico`). A seta diz se o pedido andou para a frente ou voltou;
 * a última fase é a situação de agora, e vem destacada.
 */
export function LinhaDoTempo({ fases }: { fases: readonly FaseDoPedido[] }) {
  if (fases.length === 0) return null;
  const ultimaFase = fases.findLastIndex((fase) => !isNota(fase));
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Andamento</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {fases.map((fase, indice) => {
          if (isNota(fase)) {
            return (
              <li key={indice} className="flex items-center gap-2 text-muted">
                <span aria-hidden="true" className="w-4 text-center text-base leading-none">
                  ·
                </span>
                <span className="tabular-nums">{diaEMes(fase.criadoEm)}</span>
                <span>{fase.observacoes}</span>
              </li>
            );
          }
          const atual = indice === ultimaFase;
          const marcador = MARCADOR[sentidoDaFase(fase.situacaoNova, indice)];
          return (
            <li
              key={indice}
              className={`flex items-center gap-2 ${atual ? 'font-bold text-ink' : 'text-muted'}`}
              aria-current={atual ? 'step' : undefined}
            >
              <span className={`w-4 text-center text-base leading-none font-bold ${marcador.cor}`}>
                <span aria-hidden="true">{marcador.simbolo}</span>
                {marcador.rotulo && <span className="sr-only">{marcador.rotulo}:</span>}
              </span>
              <span className="tabular-nums">{diaEMes(fase.criadoEm)}</span>
              <span>{ROTULO_HISTORICO[fase.situacaoNova]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
