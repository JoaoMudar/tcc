'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, isActive } from './nav-items';

/** Rodapé fixo no celular; coluna lateral a partir de telas médias. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Áreas do sistema"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-t-0 md:border-r"
    >
      <Link
        href="/"
        className="hidden min-h-touch items-center bg-brand-dark px-5 text-lg font-bold text-white md:flex"
      >
        Viveiro Mudar
      </Link>
      <ul className="flex md:mt-2 md:flex-col md:gap-1 md:px-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-touch items-center justify-center px-1 text-[13px] font-semibold md:justify-start md:rounded-lg md:px-4 md:text-base ${
                  active
                    ? 'text-brand-dark shadow-[inset_0_3px_0_var(--color-brand-dark)] md:bg-brand-light md:shadow-none'
                    : 'text-muted'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
