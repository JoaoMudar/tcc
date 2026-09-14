import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import pool from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { listLoginEvents } from '@/lib/auth/access-log';
import { requirePageAccess } from '@/lib/auth/guards';
import { listActiveSessions } from '@/lib/auth/session-store';
import { describeUserAgent } from '@/lib/auth/user-agent';
import { endOtherSessions, endSession } from './actions';

/** F1 UC-04: aparelhos conectados e tentativas recusadas (RF-03, RF-04, RF-07). */
export default async function SessoesPage() {
  const user = await requirePageAccess('sessoes_proprias');
  const [sessions, refused] = await Promise.all([
    listActiveSessions(pool, user.usuarioId, new Date()),
    listLoginEvents(pool, { usuarioId: user.usuarioId, sucesso: false, limit: 10 }),
  ]);

  return (
    <main>
      <PageHeader area="Minha conta" title="Aparelhos conectados" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        {sessions.map((session) => {
          const current = session.id === user.sessaoId;
          return (
            <div
              key={session.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
                current ? 'border-brand-muted bg-green-50' : 'border-line bg-white'
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{describeUserAgent(session.agenteUsuario)}</p>
                <p className="text-sm text-muted">
                  {session.ip ?? 'origem desconhecida'} · {formatDateTime(session.ultimoUsoEm)}
                </p>
              </div>
              {current ? (
                <Pill tone="green">este aparelho</Pill>
              ) : (
                <form action={endSession}>
                  <input type="hidden" name="sessao_id" value={session.id} />
                  <button type="submit" className="min-h-touch px-3 text-base font-semibold text-red-700">
                    Encerrar
                  </button>
                </form>
              )}
            </div>
          );
        })}

        {sessions.length > 1 && (
          <form action={endOtherSessions}>
            <Button type="submit" variant="secondary">
              Encerrar todas as outras
            </Button>
          </form>
        )}

        <h2 className="mt-4 text-sm font-bold tracking-widest text-muted uppercase">Tentativas recusadas</h2>
        {refused.length === 0 ? (
          <p className="text-base text-muted">Nenhuma tentativa recusada.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-base text-gray-700">
            {refused.map((event) => (
              <li key={event.id}>
                {formatDateTime(event.criadoEm)} · {describeUserAgent(event.agenteUsuario)} · {event.ip ?? 'origem desconhecida'}
              </li>
            ))}
          </ul>
        )}

        <Link href="/trocar-senha" className="mt-4 text-base font-semibold text-brand-dark">
          Trocar minha senha
        </Link>
      </div>
    </main>
  );
}
