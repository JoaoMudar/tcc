export interface NavItem {
  href: string;
  label: string;
}

/**
 * As três áreas de negócio e Configurações, com os nomes do A2 e do F1.
 * O filtro por perfil (D4 §4) entra com o acesso, na Fase 1.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/cadastros', label: 'Cadastros' },
  { href: '/producao', label: 'Produção' },
  { href: '/pedidos', label: 'Pedidos' },
  { href: '/configuracoes', label: 'Configurações' },
];

/** Ativo na própria rota e em qualquer rota abaixo dela. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
