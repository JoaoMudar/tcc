import type { Metadata } from 'next';
import Link from 'next/link';
import { BotaoSair } from '@/components/BotaoSair';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { requireUser } from '@/lib/auth/dal';
import { logout } from '../(sistema)/actions';
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
        {/* No primeiro acesso o resto do sistema redireciona para cá: sem Sair, quem não tem a senha atual fica preso */}
        {user.deveTrocarSenha && <BotaoSair logoutAction={logout} />}
      </div>
    </main>
  );
}
