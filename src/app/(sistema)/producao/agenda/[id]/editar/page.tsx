import { EditarTarefa } from '../../EditarTarefa';

/** Alterar a tarefa aberta pelo endereço; da agenda, vem em modal (`@modal`). */
export default async function EditarAtribuicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditarTarefa id={id} emModal={false} />;
}
