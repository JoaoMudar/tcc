import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import pool from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { listLoginEvents } from '@/lib/auth/access-log';
import { requirePageAccess } from '@/lib/auth/guards';
import { normalizeLogin } from '@/lib/auth/login';
import { describeUserAgent } from '@/lib/auth/user-agent';

const RESULTADOS = [
  { value: 'todos', label: 'Todas' },
  { value: 'falha', label: 'Só recusadas' },
  { value: 'sucesso', label: 'Só as que entraram' },
];

/** Auditoria de acesso (RF-04, D4: só o administrador lê). */
export default async function AcessosPage({ searchParams }: PageProps<'/admin/acessos'>) {
  await requirePageAccess('auditoria_acesso');
  const params = await searchParams;
  const login = typeof params.login === 'string' ? normalizeLogin(params.login).slice(0, 100) : '';
  const resultado = typeof params.resultado === 'string' ? params.resultado : 'todos';
  const sucesso = resultado === 'falha' ? false : resultado === 'sucesso' ? true : undefined;

  const events = await listLoginEvents(pool, { login: login || undefined, sucesso, limit: 100 });

  return (
    <main>
      <PageHeader area="Administração" title="Registro de acessos" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        <form className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <TextField label="Usuário" name="login" defaultValue={login} autoCapitalize="none" />
          <SelectField label="Resultado" name="resultado" options={RESULTADOS} defaultValue={resultado} />
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>

        {events.length === 0 ? (
          <p className="text-base text-muted">Nenhuma tentativa encontrada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">
                    {event.usuarioNome ?? event.loginTentado}
                    {!event.usuarioNome && <span className="text-sm font-normal text-muted"> (usuário inexistente)</span>}
                  </span>
                  {event.sucesso ? <Pill tone="green">Entrou</Pill> : <Pill tone="red">Recusado</Pill>}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDateTime(event.criadoEm)} · {describeUserAgent(event.agenteUsuario)} · {event.ip ?? 'origem desconhecida'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
