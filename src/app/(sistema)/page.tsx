import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { requireUser } from '@/lib/auth/dal';
import { visibleNavItems } from '@/lib/auth/menu';
import { isDatabaseReachable } from '@/lib/health';

export default async function HomePage() {
  const user = await requireUser();
  const reachable = await isDatabaseReachable();

  return (
    <main>
      <PageHeader area="Viveiro Mudar" title={`Olá, ${user.nomeExibicao}`} />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        {!reachable && <Notice tone="error">Sem conexão com o banco de dados. Avise o administrador.</Notice>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleNavItems(user.perfil).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-20 items-center rounded-xl border border-line bg-white px-5 text-lg font-bold text-ink active:bg-brand-light"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
