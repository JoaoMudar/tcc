'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type NavItem, isActive } from './nav-items';

interface AppNavProps {
  /** Já filtrados pelo perfil, no servidor. */
  items: readonly NavItem[];
  userName: string;
  logoutAction: () => Promise<void>;
}

const MORE_HREF = '/mais';

/** Rodapé fixo no celular (áreas e "Mais"); coluna lateral com tudo a partir de telas médias. */
export function AppNav({ items, userName, logoutAction }: AppNavProps) {
  const pathname = usePathname();
  const primary = items.filter((item) => item.placement === 'primary');
  const more = items.filter((item) => item.placement === 'more');
  const moreActive = pathname === MORE_HREF || more.some((item) => isActive(pathname, item.href));

  const mobileLink = (href: string, label: string, active: boolean) => (
    <li key={href} className="flex-1">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-touch items-center justify-center px-1 text-[13px] font-semibold ${
          active ? 'text-brand-dark shadow-[inset_0_3px_0_var(--color-brand-dark)]' : 'text-muted'
        }`}
      >
        {label}
      </Link>
    </li>
  );

  return (
    <>
      <nav
        aria-label="Áreas do sistema"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white md:hidden"
      >
        <ul className="flex">
          {primary.map((item) => mobileLink(item.href, item.label, isActive(pathname, item.href)))}
          {mobileLink(MORE_HREF, 'Mais', moreActive)}
        </ul>
      </nav>

      <nav
        aria-label="Menu"
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-white md:flex"
      >
        <Link href="/" className="flex min-h-touch items-center bg-brand-dark px-5 text-lg font-bold text-white">
          Viveiro Mudar
        </Link>
        <ul className="mt-2 flex flex-col gap-1 px-2">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-touch items-center rounded-lg px-4 text-base font-semibold ${
                    active ? 'bg-brand-light text-brand-dark' : 'text-muted'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto border-t border-line p-4">
          <p className="truncate text-sm text-muted">{userName}</p>
          <form action={logoutAction}>
            <button type="submit" className="mt-1 min-h-touch w-full rounded-lg text-left text-base font-semibold text-ink">
              Sair
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
