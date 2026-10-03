import { EditarTarefa } from '@/app/(sistema)/producao/agenda/EditarTarefa';

/** Alterar a tarefa em modal, por cima da agenda. */
export default async function EditarEmModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditarTarefa id={id} emModal />;
}
