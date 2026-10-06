import { type PedidoDeRegistro, RegistrarTarefaFeita } from '@/app/(sistema)/producao/agenda/RegistrarTarefaFeita';

/** Confirmar a tarefa feita fora da agenda em modal, por cima da agenda. */
export default async function RegistrarEmModal({ searchParams }: { searchParams: Promise<PedidoDeRegistro> }) {
  return <RegistrarTarefaFeita pedido={await searchParams} emModal />;
}
