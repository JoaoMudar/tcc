import { type PedidoDeLancamento, LancarTarefa } from '@/app/(sistema)/producao/agenda/LancarTarefa';

/** Lançar tarefa em modal, por cima da agenda. */
export default async function LancarEmModal({ searchParams }: { searchParams: Promise<PedidoDeLancamento> }) {
  return <LancarTarefa pedido={await searchParams} emModal />;
}
