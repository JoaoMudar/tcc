import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { findSemana, resumoFechamento } from '@/lib/agenda';
import { hojeNoViveiro } from '@/lib/datas';
import pool from '@/lib/db';
import { lerSemana, rotuloSemana } from '@/lib/semanas';
import { requirePageAccess } from '@/lib/auth/guards';
import { FecharSemanaForm } from '../FecharSemanaForm';

interface FecharSemanaPageProps {
  searchParams: Promise<{ semana?: string }>;
}

/** T5.6, F1 UC-21: o que entra no realizado, e com que marca, antes de travar a semana. */
export default async function FecharSemanaPage({ searchParams }: FecharSemanaPageProps) {
  await requirePageAccess('fechamento_semana', 'A');
  const { semana: semanaPedida } = await searchParams;
  const inicio = lerSemana(semanaPedida, hojeNoViveiro());
  const semana = await findSemana(pool, inicio);
  const resumo = semana?.situacao === 'publicada' ? await resumoFechamento(pool, semana.id) : null;

  return (
    <main>
      <PageHeader area="2 · Produção" title={`Fechar a semana · ${rotuloSemana(inicio)}`} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href={`/producao/agenda?semana=${inicio}`} className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {!semana && <Notice tone="info">Esta semana ainda não foi aberta.</Notice>}
        {semana?.situacao === 'rascunho' && <Notice tone="info">Publique a semana antes de fechá-la.</Notice>}
        {semana?.situacao === 'fechada' && <Notice tone="info">Esta semana já está fechada.</Notice>}
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
      </div>
    </main>
  );
}
