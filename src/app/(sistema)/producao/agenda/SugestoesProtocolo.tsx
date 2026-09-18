import Link from 'next/link';
import { Pill } from '@/components/ui/Pill';
import { formatData } from '@/lib/datas';
import { TOM_SITUACAO_ETAPA } from '@/lib/protocolo-rotulos';
import type { Sugestao } from '@/lib/protocolos';

interface SugestoesProps {
  sugestoes: readonly Sugestao[];
  semana: string;
  podeLancar: boolean;
}

/**
 * RF-47: o protocolo **sugere**, e quem lança é a gerência. Enquanto ninguém
 * aceitar, nada existe na agenda: não há tarefa sem responsável, nem tarefa que
 * apareceu sozinha na semana de alguém (RN-41).
 *
 * Aceitar abre o mesmo formulário de lançar tarefa, já com a etapa, o lote e o
 * tipo preenchidos. O resto é exigido normalmente, e é isso que separa esta
 * solução da geração automática que a versão anterior do requisito previa.
 */
export function SugestoesProtocolo({ sugestoes, semana, podeLancar }: SugestoesProps) {
  if (sugestoes.length === 0) return null;

  return (
    <section aria-labelledby="sugestoes-titulo" className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
      <h2 id="sugestoes-titulo" className="text-sm font-bold tracking-widest text-muted uppercase">
        O protocolo sugere
      </h2>
      <p className="text-sm text-muted">
        Nada aqui está na semana. A sugestão vira tarefa quando alguém a aceita e a preenche.
      </p>

      <ul className="flex flex-col gap-2">
        {sugestoes.map((s) => {
          // O lote e o tipo vão preenchidos; o dia, o turno e quem faz continuam sendo decisão de quem monta
          const destino =
            `/producao/agenda/nova?semana=${semana}` +
            `&etapa=${s.loteEtapaId}&lote=${s.loteId}&tipo=${s.tipoTarefaId}&turno=${s.turnoId}`;

          return (
            <li key={`${s.loteId}-${s.loteEtapaId}`} className="flex items-center justify-between gap-3 border-t border-line pt-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  {s.rotulo} · {s.loteCodigo}
                </p>
                <p className="truncate text-sm text-muted">
                  {s.especie}
                  {s.canteiro && ` · ${s.canteiro}`} · vence {formatData(s.vencimento)}
                  {s.diasAtraso > 0 && ` · ${s.diasAtraso} ${s.diasAtraso === 1 ? 'dia' : 'dias'} de atraso`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.situacao !== 'sem_alerta' && (
                  <Pill tone={TOM_SITUACAO_ETAPA[s.situacao] === 'danger' ? 'red' : TOM_SITUACAO_ETAPA[s.situacao] === 'warning' ? 'amber' : 'green'}>
                    {s.diasAtraso > 0 ? 'atrasada' : 'a vencer'}
                  </Pill>
                )}
                {podeLancar && (
                  <Link
                    href={destino}
                    className="inline-flex min-h-touch items-center rounded-xl border-2 border-brand px-4 text-base font-bold text-brand active:bg-brand-light"
                  >
                    Aceitar
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
