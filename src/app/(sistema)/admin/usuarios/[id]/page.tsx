import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { findUsuario, listPessoasDisponiveis } from '@/lib/usuarios';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { isLocked } from '@/lib/auth/lockout';
import { EditUserForm } from './EditUserForm';
import { ResetPasswordForm } from './ResetPasswordForm';

export default async function UsuarioPage({ params, searchParams }: PageProps<'/admin/usuarios/[id]'>) {
  await requirePageAccess('usuarios', 'A');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [usuario, pessoas] = await Promise.all([findUsuario(pool, id), listPessoasDisponiveis(pool, id)]);
  if (!usuario) notFound();
  const criado = (await searchParams).criado === '1';

  return (
    <main>
      <PageHeader area="Administração" title={usuario.nomeExibicao} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/admin/usuarios" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {criado && (
          <Notice tone="success">
            Usuário criado. Passe o usuário <strong>{usuario.login}</strong> e a senha provisória para a pessoa.
          </Notice>
        )}
        <p className="text-base text-gray-700">
          Entra como <strong>{usuario.login}</strong>
          {usuario.deveTrocarSenha && ' · ainda com senha provisória'}
        </p>
        {isLocked(usuario.bloqueadoAte, new Date()) && (
          <Notice tone="warning">
            Bloqueado por tentativas erradas até {formatDateTime(usuario.bloqueadoAte!)}. Definir uma senha provisória
            libera na hora.
          </Notice>
        )}

        <EditUserForm usuario={usuario} pessoas={pessoas} />

        <h2 className="mt-6 text-sm font-bold tracking-widest text-muted uppercase">Senha</h2>
        <ResetPasswordForm usuarioId={usuario.id} />
      </div>
    </main>
  );
}
