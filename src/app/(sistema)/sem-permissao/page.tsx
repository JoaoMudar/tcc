import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { requireUser } from '@/lib/auth/dal';

export default async function SemPermissaoPage() {
  await requireUser();

  return (
    <main>
      <PageHeader area="Viveiro Mudar" title="Sem permissão" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        <Notice tone="warning">Seu perfil não tem acesso a esta tela.</Notice>
        <Link href="/" className="text-base font-semibold text-brand-dark">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
