import type { ReactNode } from 'react';
import { AppNav } from '@/components/AppNav';
import { requireUser } from '@/lib/auth/dal';
import { visibleNavItems } from '@/lib/auth/menu';
import { logout } from './actions';

/**
 * Tudo que exige sessão mora neste grupo. O layout monta o menu do perfil;
 * cada página ainda chama o próprio guard, porque layout não roda de novo a
 * cada navegação.
 */
export default async function SistemaLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="md:flex md:min-h-dvh">
      <AppNav items={visibleNavItems(user.perfil)} userName={user.nomeExibicao} logoutAction={logout} />
      {/* pb-24: espaço para a navegação fixa no rodapé do celular */}
      <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>
    </div>
  );
}
