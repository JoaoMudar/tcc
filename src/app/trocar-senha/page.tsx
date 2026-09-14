import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { requireUser } from '@/lib/auth/dal';
import { ChangePasswordForm } from './ChangePasswordForm';

export const metadata: Metadata = { title: 'Trocar senha · Viveiro Mudar' };

export default async function TrocarSenhaPage() {
  const user = await requireUser({ allowPasswordChange: true });

  return (
    <main className="min-h-dvh">
      <PageHeader area="Viveiro Mudar" title="Trocar senha" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        {user.deveTrocarSenha ? (
          <Notice tone="warning">Primeiro acesso. Defina uma senha própria antes de continuar.</Notice>
        ) : (
          <Link href="/conta/sessoes" className="text-base font-semibold text-brand-dark">
            Voltar
          </Link>
        )}
        <ChangePasswordForm />
      </div>
    </main>
  );
}
