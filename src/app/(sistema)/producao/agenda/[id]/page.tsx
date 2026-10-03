import { FichaTarefa } from '../FichaTarefa';

interface AtribuicaoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
}

/** A ficha da tarefa aberta pelo endereço; da agenda, ela vem em modal (`@modal`). */
export default async function AtribuicaoPage({ params, searchParams }: AtribuicaoPageProps) {
  const [{ id }, { feito }] = await Promise.all([params, searchParams]);
  return <FichaTarefa id={id} feito={feito} emModal={false} />;
}
