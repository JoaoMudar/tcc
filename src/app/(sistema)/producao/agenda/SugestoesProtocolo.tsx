'use client';

import { Pill } from '@/components/ui/Pill';
import { formatData } from '@/lib/datas';
import { TOM_SITUACAO_ETAPA } from '@/lib/protocolo-rotulos';
import type { Sugestao } from '@/lib/protocolos';
import { providenciaDaSugestao } from '@/lib/providencia';
import { PainelProvidencia } from './PainelProvidencia';
import { ToastDesfazer } from './ToastDesfazer';
import { useProvidencia } from './useProvidencia';

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
 * Tocar na sugestão abre as mesmas três saídas de "Pedem providência" (RF-66):
 * postergar, adicionar na agenda (o mesmo formulário de lançar tarefa, já com a
 * etapa, o lote e o tipo preenchidos, e o resto exigido normalmente) ou concluir
 * sem agenda.
 */
export function SugestoesProtocolo({ sugestoes, semana, podeLancar }: SugestoesProps) {
  const { aberta, abrir, fechar, feito, aviso, fecharAviso } = useProvidencia();
  if (sugestoes.length === 0) return <ToastDesfazer aviso={aviso} onFechar={fecharAviso} />;

  return (
    <section aria-labelledby="sugestoes-titulo" className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
      <h2 id="sugestoes-titulo" className="text-sm font-bold tracking-widest text-muted uppercase">
        Sugestão do protocolo
      </h2>

      <ul className="flex flex-col gap-2">
        {sugestoes.map((s) => {
          const conteudo = (
            <>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  {s.rotulo} · {s.loteCodigo}
                </p>
                <p className="truncate text-sm text-muted">
                  {s.especie}
                  {s.canteiro && ` · ${s.canteiro}`} · Data limite: {formatData(s.vencimento)}
                </p>
              </div>
              {s.situacao !== 'sem_alerta' && (
                <span className="shrink-0">
                  <Pill tone={TOM_SITUACAO_ETAPA[s.situacao] === 'danger' ? 'red' : TOM_SITUACAO_ETAPA[s.situacao] === 'warning' ? 'amber' : 'green'}>
                    {s.diasAtraso > 0 ? 'atrasada' : 'a vencer'}
                  </Pill>
                </span>
              )}
            </>
          );
          const linha = 'flex w-full items-center justify-between gap-3 border-t border-line pt-2 text-left';

          return (
            <li key={`${s.loteId}-${s.loteEtapaId}`}>
              {podeLancar ? (
                <button type="button" onClick={() => abrir(providenciaDaSugestao(s, semana))} className={`${linha} min-h-touch`}>
                  {conteudo}
                </button>
              ) : (
                <div className={linha}>{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>

      {aberta && <PainelProvidencia key={aberta.chave} providencia={aberta} onFechar={fechar} onFeito={feito} />}
      <ToastDesfazer aviso={aviso} onFechar={fecharAviso} />
    </section>
  );
}
