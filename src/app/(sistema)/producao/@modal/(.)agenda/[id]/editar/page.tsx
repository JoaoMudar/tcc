import { EditarTarefa } from '@/app/(sistema)/producao/agenda/EditarTarefa';

/** Alterar a tarefa em modal, por cima da agenda. `semana` a traz para outra semana (RF-66). */
export default async function EditarEmModal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string; voltar?: string }>;
}) {
  const [{ id }, { semana, voltar }] = await Promise.all([params, searchParams]);
  return <EditarTarefa id={id} semana={semana} voltar={voltar} emModal />;
}
