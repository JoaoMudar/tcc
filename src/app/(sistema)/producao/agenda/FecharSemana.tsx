import { Notice } from '@/components/ui/Notice';
import { findSemana, resumoFechamento } from '@/lib/agenda';
import { hojeNoViveiro } from '@/lib/datas';
import pool from '@/lib/db';
import { lerSemana, rotuloSemana, semanaJaPassou } from '@/lib/semanas';
import { requirePageAccess } from '@/lib/auth/guards';
import { FecharSemanaForm } from './FecharSemanaForm';
import { TelaDeTarefa } from './TelaDeTarefa';

/**
 * T5.6, F1 UC-21: o que entra no realizado, e com que marca, antes de travar a
 * semana. Só a semana que já terminou se fecha (RF-28).
 */
export async function FecharSemana({ semana: semanaPedida, emModal }: { semana?: string; emModal: boolean }) {
  await requirePageAccess('fechamento_semana', 'A');
  const hoje = hojeNoViveiro();
  const inicio = lerSemana(semanaPedida, hoje);
  const semana = await findSemana(pool, inicio);
  const passou = semanaJaPassou(inicio, hoje);
  const resumo = semana?.situacao === 'aberta' && passou ? await resumoFechamento(pool, semana.id) : null;

  return (
    <TelaDeTarefa titulo={`Fechar a semana · ${rotuloSemana(inicio)}`} emModal={emModal} voltar={{ href: `/producao?dia=${inicio}` }}>
      {!semana && <Notice tone="info">Esta semana não tem nenhuma tarefa lançada.</Notice>}
      {semana?.situacao === 'fechada' && <Notice tone="info">Esta semana já está fechada.</Notice>}
      {semana?.situacao === 'aberta' && !passou && (
        <Notice tone="info">A semana ainda não terminou.</Notice>
      )}
      {semana && resumo && (
        <>
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-base font-semibold text-ink">Confirmadas</span>
              <span className="text-xl font-bold text-ink">{resumo.confirmadas}</span>
            </div>
            <span className="text-sm text-muted">A gerência registrou que foram feitas.</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-amber-600 bg-white p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-base font-semibold text-ink">Sem confirmação</span>
              <span className="text-xl font-bold text-amber-800">{resumo.semConfirmacao}</span>
            </div>
            <span className="text-sm text-amber-800">Entram como realizadas, marcadas de não confirmadas.</span>
          </div>
          {resumo.semNinguem > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold text-ink">Sem ninguém escalado</span>
                <span className="text-xl font-bold text-ink">{resumo.semNinguem}</span>
              </div>
              <span className="text-sm text-muted">Ninguém pegou: seguem pendentes.</span>
            </div>
          )}
          <p className="text-sm text-muted">Depois de fechada, a semana não se altera. Correção, só por lançamento na semana seguinte.</p>
          <FecharSemanaForm semana={semana.inicio} />
        </>
      )}
    </TelaDeTarefa>
  );
}
