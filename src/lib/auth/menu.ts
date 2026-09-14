import 'server-only';
import { NAV_ITEMS, type NavItem } from '@/components/nav-items';
import { type Perfil, can } from '@/lib/permissions';

/** D4 §4, nível da interface: o menu oculta o que o perfil não pode ler. */
export function visibleNavItems(perfil: Perfil): NavItem[] {
  return NAV_ITEMS.filter((item) => can(perfil, item.resource, 'L'));
}
