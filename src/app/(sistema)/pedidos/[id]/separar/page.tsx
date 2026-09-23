import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { listCargas } from '@/lib/cargas';
import { diaUtilAnterior, formatData, hojeNoViveiro } from '@/lib/datas';
import pool from '@/lib/db';
import { findPedido } from '@/lib/pedidos';
import { ROTULO_URGENCIA, type Urgencia, urgenciaPedido } from '@/lib/pedidos-rotulos';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { ContarCarga } from './ContarCarga';
import { OrganizarCargas } from './OrganizarCargas';

interface SepararPageProps {
  params: Promise<{ id: string }>;
}

/** Quanto mais acima na tabela, mais forte a cor: é a ordem da pressa. */
const TOM_URGENCIA: Record<Exclude<Urgencia, null>, string> = {
  atrasada: 'border-red-700 bg-red-100 text-red-900',
  entrega_hoje: 'border-red-700 bg-red-100 text-red-900',
  entrega_amanha: 'border-red-500 bg-red-50 text-red-800',
  carregar_hoje: 'border-amber-500 bg-amber-50 text-amber-900',
  em_breve: 'border-line bg-white text-ink',
};

/**
 * T8.14: a contagem para carregar, no galpão.
 *
 * Dois passos, escolhidos pelo estado e não por uma escolha da pessoa: pedido
 * aprovado e sem carga abre a organização das viagens; pedido em separação abre
 * a contagem. Quem chega aqui já sabe o que veio fazer.
 */
export default async function SepararPage({ params }: SepararPageProps) {
  await requirePageAccess('cargas_pedido');
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const pedido = await findPedido(pool, id);
  if (!pedido) notFound();
  if (pedido.situacao !== 'aprovado' && pedido.situacao !== 'separando') {
    redirect(`/pedidos/${id}`);
  }

  const cargas = await listCargas(pool, id);
  const organizando = cargas.length === 0;

  const hoje = hojeNoViveiro();
  const diaDeCarregar = pedido.dataEntrega ? diaUtilAnterior(pedido.dataEntrega) : null;
  const urgencia = urgenciaPedido(hoje, pedido.dataEntrega, diaDeCarregar);

  // Item real: o pai genérico não vai no caminhão, os filhos dele é que vão
  const itensReais = pedido.itens.filter((item) => !item.generico);

  return (
    <main>
      <PageHeader area="3 · Comercial" title={`Separar pedido ${pedido.numero}`} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8">
        <Link href={`/pedidos/${id}`} className="text-base font-semibold text-brand-dark">
          Voltar ao pedido
        </Link>

        <section className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4">
          <p className="text-base font-bold text-ink">{pedido.cliente}</p>
          {pedido.dataEntrega ? (
            <p className="text-sm text-muted">
              Entrega em {formatData(pedido.dataEntrega)} · carregar em {formatData(diaDeCarregar!)}
            </p>
          ) : (
            <p className="text-sm text-muted">Sem data de entrega combinada.</p>
          )}
        </section>

        {urgencia && (
          <p className={`rounded-xl border-2 p-4 text-center text-lg font-bold ${TOM_URGENCIA[urgencia]}`}>
            {ROTULO_URGENCIA[urgencia]}
          </p>
        )}

        {organizando ? (
          <>
            <Notice tone="info">
              Antes de separar, diga em quantas viagens o pedido sai. Cada carga é conferida por inteiro.
            </Notice>
            <OrganizarCargas
              pedidoId={pedido.id}
              itens={itensReais.map((item) => ({
                id: item.id,
                especie: item.especie ?? 'Espécie não definida',
                // A aprovação exige recipiente e quantidade: os fallbacks são só para o tipo
                recipiente: item.recipiente ?? '',
                quantidade: item.quantidade ?? 0,
              }))}
            />
          </>
        ) : (
          <ContarCarga
            pedidoId={pedido.id}
            cargas={cargas.map((carga) => ({
              id: carga.id,
              numero: carga.numero,
              situacao: carga.situacao,
              itens: carga.itens.map((item) => ({
                id: item.id,
                especie: item.especie,
                recipiente: item.recipiente,
                alturaM: item.alturaM,
                quantidade: item.quantidade,
                separado: item.separado,
              })),
            }))}
          />
        )}
      </div>
    </main>
  );
}
