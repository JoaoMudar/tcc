import { Pill } from '@/components/ui/Pill';
import { formatData } from '@/lib/datas';
import { SITUACOES_ETAPA, TIPOS_AGENDAMENTO } from '@/lib/protocolo-rotulos';
import type { EtapaDoLote } from '@/lib/protocolos';

const TOM_PILL = { em_dia: 'green', atencao: 'amber', atraso: 'red' } as const;

/**
 * RF-51, RF-52: o que este lote já recebeu e o que ele tem a receber. A etapa de
 * alerta desligado não recebe indicação nenhuma, nem verde (RN-35, TA-37): a
 * irrigação diária colorida deixaria o viveiro inteiro em atraso toda manhã.
 */
export function ProtocoloDoLote({ etapas }: { etapas: readonly EtapaDoLote[] }) {
  if (etapas.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="mt-4 text-sm font-bold tracking-widest text-muted uppercase">Protocolo</h2>
      <ol className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
        {etapas.map((etapa) => {
          const tom = etapa.situacao && etapa.situacao !== 'sem_alerta' ? TOM_PILL[etapa.situacao] : null;

          return (
            <li key={etapa.protocoloEtapaId} className="flex flex-col gap-0.5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-base font-semibold ${etapa.concluida ? 'text-muted' : 'text-ink'}`}>
                  {etapa.rotulo}
                </span>
                {etapa.concluida ? (
                  <Pill tone="neutral">concluída</Pill>
                ) : (
                  tom && (
                    <Pill tone={tom}>
                      {etapa.situacao === 'atraso' && etapa.diasAtraso > 0
                        ? `${etapa.diasAtraso} ${etapa.diasAtraso === 1 ? 'dia' : 'dias'} de atraso`
                        : SITUACOES_ETAPA[etapa.situacao!]}
                    </Pill>
                  )
                )}
              </div>

              <p className="text-sm text-muted">
                {etapa.tipoTarefa} · {TIPOS_AGENDAMENTO[etapa.tipoAgendamento]}
                {etapa.ocorrencias > 0 && etapa.tipoAgendamento === 'recorrente' && ` · ${etapa.ocorrencias}x`}
              </p>

              <p className="text-sm text-muted">
                {etapa.ultimaExecucaoEm ? `Última: ${formatData(etapa.ultimaExecucaoEm)}` : 'Nunca executada'}
                {etapa.proximoVencimento
                  ? ` · próxima: ${formatData(etapa.proximoVencimento)}`
                  : etapa.concluida
                    ? ''
                    : ' · ainda não vence: a etapa anterior não foi concluída'}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
