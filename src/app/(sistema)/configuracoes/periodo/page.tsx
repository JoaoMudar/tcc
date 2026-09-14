import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { can } from '@/lib/permissions';
import { formatDuracao, jornadaDiaria, listTurnos, turnoLabel } from '@/lib/turnos';
import { requirePageAccess } from '@/lib/auth/guards';
import { NovoTurnoForm } from './NovoTurnoForm';
import { TurnoForm } from './TurnoForm';

/** F1 UC-05: período de trabalho (RF-08). Gerência lê, chefia e admin alteram. */
export default async function PeriodoTrabalhoPage() {
  const user = await requirePageAccess('periodo_trabalho');
  const turnos = await listTurnos(pool);
  const podeEditar = can(user.perfil, 'periodo_trabalho', 'A');
  const podeCriar = can(user.perfil, 'periodo_trabalho', 'C');

  return (
    <main>
      <PageHeader area="Configurações" title="Período de trabalho" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/configuracoes" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {!podeEditar && <Notice tone="info">Seu perfil pode consultar o período de trabalho, mas não alterar.</Notice>}

        {turnos.map((turno) => (
          <TurnoForm key={turno.id} turno={{ ...turno, label: turnoLabel(turno.nome) }} podeEditar={podeEditar} />
        ))}

        <div className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-base">
          <span>Jornada diária</span>
          <strong>{formatDuracao(jornadaDiaria(turnos))}</strong>
        </div>
        <Notice tone="info">Usado como jornada padrão quando a tarefa não tiver horário marcado.</Notice>

        {podeCriar && (
          <>
            <h2 className="mt-6 text-sm font-bold tracking-widest text-muted uppercase">Novo turno</h2>
            <NovoTurnoForm />
          </>
        )}
      </div>
    </main>
  );
}
