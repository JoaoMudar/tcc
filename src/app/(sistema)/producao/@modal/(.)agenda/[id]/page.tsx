import { FichaTarefa } from '@/app/(sistema)/producao/agenda/FichaTarefa';

/** A ficha da tarefa em modal, por cima da agenda. */
export default async function FichaEmModal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ feito?: string }> }) {
  const [{ id }, { feito }] = await Promise.all([params, searchParams]);
  return <FichaTarefa id={id} feito={feito} emModal />;
}
