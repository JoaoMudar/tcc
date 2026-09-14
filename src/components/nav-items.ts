import type { Recurso } from '@/lib/permissions';

export interface NavItem {
  href: string;
  label: string;
  /** Recurso do D4 que precisa de leitura para o item aparecer. */
  resource: Recurso;
  /** `primary` vai no rodapé do celular; `more` fica atrás de "Mais". */
  placement: 'primary' | 'more';
}

/**
 * Todos os itens do menu. O filtro por perfil acontece no servidor
 * (`src/lib/auth/menu.ts`): o navegador recebe só a lista já filtrada.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/cadastros', label: 'Cadastros', resource: 'especies', placement: 'primary' },
  { href: '/producao', label: 'Produção', resource: 'agenda', placement: 'primary' },
  { href: '/pedidos', label: 'Pedidos', resource: 'pedidos', placement: 'primary' },
  { href: '/configuracoes', label: 'Configurações', resource: 'parametros', placement: 'more' },
  { href: '/admin/usuarios', label: 'Usuários', resource: 'usuarios', placement: 'more' },
  { href: '/admin/acessos', label: 'Registro de acessos', resource: 'auditoria_acesso', placement: 'more' },
  { href: '/conta/sessoes', label: 'Aparelhos conectados', resource: 'sessoes_proprias', placement: 'more' },
];

/** Ativo na própria rota e em qualquer rota abaixo dela. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
