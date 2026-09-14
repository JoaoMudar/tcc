/**
 * Os três perfis e seus nomes na tela. Separado de `permissions.ts` para que
 * formulário no navegador possa usar os rótulos sem levar a matriz junto (TA-60).
 */
export type Perfil = 'admin' | 'chefia' | 'gerencia';

export const PERFIL_LABELS: Record<Perfil, string> = {
  chefia: 'Chefia',
  gerencia: 'Gerência',
  admin: 'Administrador',
};

export const PERFIL_OPTIONS = (Object.keys(PERFIL_LABELS) as Perfil[]).map((value) => ({
  value,
  label: PERFIL_LABELS[value],
}));

/** Valor do select de pessoa que significa "sem vínculo". Aqui, e não em usuarios.ts, para o SQL não ir ao navegador. */
export const SEM_PESSOA = 'nenhuma';

export function parsePerfil(value: unknown): Perfil | null {
  return typeof value === 'string' && value in PERFIL_LABELS ? (value as Perfil) : null;
}
