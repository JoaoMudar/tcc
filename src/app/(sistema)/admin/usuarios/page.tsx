import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { TextField } from '@/components/ui/TextField';
import pool from '@/lib/db';
import { PERFIL_LABELS, type Perfil } from '@/lib/perfis';
import { listUsuarios } from '@/lib/usuarios';
import { requirePageAccess } from '@/lib/auth/guards';
import { isLocked } from '@/lib/auth/lockout';

const PERFIL_TONE: Record<Perfil, PillTone> = { chefia: 'green', gerencia: 'blue', admin: 'neutral' };

/** F1 UC-03: única tela fechada aos dois perfis de negócio (D4 §3.5). */
export default async function UsuariosPage({ searchParams }: PageProps<'/admin/usuarios'>) {
  await requirePageAccess('usuarios');
  const params = await searchParams;
  const busca = typeof params.busca === 'string' ? params.busca.slice(0, 80) : '';
  const usuarios = await listUsuarios(pool, busca);
  const now = new Date();

  return (
    <main>
      <PageHeader area="Administração" title="Usuários" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        <form className="flex items-end gap-2">
          <TextField label="Buscar usuário" name="busca" defaultValue={busca} className="flex-1" />
          <Button type="submit" variant="secondary" className="w-auto">
            Buscar
          </Button>
        </form>

        {usuarios.map((usuario) => {
          const situacao = [
            usuario.login,
            usuario.ativo ? 'ativo' : 'desativado',
            usuario.deveTrocarSenha ? 'senha provisória' : null,
            isLocked(usuario.bloqueadoAte, now) ? 'bloqueado por tentativas' : null,
          ].filter(Boolean);
          return (
            <Link
              key={usuario.id}
              href={`/admin/usuarios/${usuario.id}`}
              className={`flex flex-col gap-1 rounded-xl border border-line bg-white p-4 active:bg-brand-light ${
                usuario.ativo ? '' : 'opacity-60'
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">{usuario.nomeExibicao}</span>
                <Pill tone={PERFIL_TONE[usuario.perfil]}>{PERFIL_LABELS[usuario.perfil]}</Pill>
              </span>
              <span className="text-sm text-muted">{situacao.join(' · ')}</span>
            </Link>
          );
        })}
        {usuarios.length === 0 && <p className="text-base text-muted">Nenhum usuário encontrado.</p>}

        <Link
          href="/admin/usuarios/novo"
          className="mt-2 inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark"
        >
          + Novo usuário
        </Link>
      </div>
    </main>
  );
}
