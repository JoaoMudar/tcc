import { EditarTarefa } from '../../EditarTarefa';

/** Alterar a tarefa aberta pelo endereço; da agenda, vem em modal (`@modal`). */
export default async function EditarAtribuicaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string; voltar?: string }>;
}) {
  const [{ id }, { semana, voltar }] = await Promise.all([params, searchParams]);
  return <EditarTarefa id={id} semana={semana} voltar={voltar} emModal={false} />;
}
