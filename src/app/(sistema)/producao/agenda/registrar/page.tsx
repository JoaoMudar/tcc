import { type PedidoDeRegistro, RegistrarTarefaFeita } from '../RegistrarTarefaFeita';

/** Confirmar a tarefa feita fora da agenda pelo endereço; da agenda, vem em modal (`@modal`). */
export default async function RegistrarPage({ searchParams }: { searchParams: Promise<PedidoDeRegistro> }) {
  return <RegistrarTarefaFeita pedido={await searchParams} emModal={false} />;
}
