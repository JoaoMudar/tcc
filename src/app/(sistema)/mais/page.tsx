import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { requireUser } from '@/lib/auth/dal';
import { visibleNavItems } from '@/lib/auth/menu';
import { logout } from '../actions';

/** No celular, o que não cabe no rodapé: configurações, administração, conta e sair. */
export default async function MaisPage() {
  const user = await requireUser();
  const items = visibleNavItems(user.perfil).filter((item) => item.placement === 'more');

  return (
    <main>
      <PageHeader area={user.nomeExibicao} title="Mais" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-touch items-center rounded-xl border border-line bg-white px-5 text-lg font-semibold text-ink active:bg-brand-light"
          >
            {item.label}
          </Link>
        ))}
        <form action={logout} className="mt-4">
          <Button type="submit" variant="outline">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
