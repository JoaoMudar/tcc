import { FecharSemana } from '@/app/(sistema)/producao/agenda/FecharSemana';

/** Fechar a semana em modal, por cima da agenda. */
export default async function FecharEmModal({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { semana } = await searchParams;
  return <FecharSemana semana={semana} emModal />;
}
