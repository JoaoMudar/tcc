import { FecharSemana } from '../FecharSemana';

/** Fechar a semana pelo endereço; da agenda, vem em modal (`@modal`). */
export default async function FecharSemanaPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams;
  return <FecharSemana semana={semana} emModal={false} />;
}
