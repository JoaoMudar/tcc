import { type PedidoDeLancamento, LancarTarefa } from '../LancarTarefa';

/** Lançar tarefa pelo endereço (celular, sem JavaScript); da agenda, vem em modal (`@modal`). */
export default async function NovaAtribuicaoPage({ searchParams }: { searchParams: Promise<PedidoDeLancamento> }) {
  return <LancarTarefa pedido={await searchParams} emModal={false} />;
}
