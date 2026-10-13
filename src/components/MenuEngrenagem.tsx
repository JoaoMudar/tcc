'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { IconeEngrenagem } from './IconeEngrenagem';
import { type NavItem, isActive } from './nav-items';

/**
 * A engrenagem do rodapé da coluna lateral: configurações, usuários, registro
 * de acessos e aparelhos conectados ficam atrás dela, e o alto da coluna guarda
 * só as três áreas. Botão com estado, e não <details>, que não abria no
 * Firefox do celular.
 */
export function MenuEngrenagem({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  // Aberto na rota em que foi tocado: trocar de rota já fecha, sem efeito
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === pathname;
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useId();
  const ativo = items.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAbertoEm(null);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbertoEm(null);
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAbertoEm(aberto ? null : pathname)}
        aria-label="Configurações"
        aria-expanded={aberto}
        aria-controls={painel}
        className={`flex min-h-touch min-w-touch items-center justify-center rounded-lg ${
          ativo || aberto ? 'bg-brand-light text-brand-dark' : 'text-muted'
        }`}
      >
        <IconeEngrenagem />
      </button>
      {aberto && (
        <ul
          id={painel}
          className="absolute right-0 bottom-full z-20 mb-2 flex w-60 flex-col gap-1 rounded-xl border border-line bg-white p-2 shadow-lg"
        >
          {items.map((item) => {
            const atual = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setAbertoEm(null)}
                  aria-current={atual ? 'page' : undefined}
                  className={`flex min-h-touch items-center rounded-lg px-4 text-base font-semibold ${
                    atual ? 'bg-brand-light text-brand-dark' : 'text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
