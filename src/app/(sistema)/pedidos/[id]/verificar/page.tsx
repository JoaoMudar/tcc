import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { findPedido, listEspeciesPermitidas } from '@/lib/pedidos';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { AcoesVerificacao } from './AcoesVerificacao';
import { ComposicaoGenerico } from './ComposicaoGenerico';
import { VerificacaoItem } from './VerificacaoItem';

interface VerificarPageProps {
  params: Promise<{ id: string }>;
}

/**
 * T8.12, RF-56: a conferência de disponibilidade, feita no pátio, no celular.
 *
 * A tela é de quem está andando entre os canteiros: progresso fixo no topo,
 * um cartão por item, cor dizendo o estado e botão grande. O que ela **não**
 * mostra é preço: conferir é responder se tem a muda, e o valor da venda não
 * ajuda nessa resposta (e é da chefia, D4 §3.2).
 */
export default async function VerificarPage({ params }: VerificarPageProps) {
  await requirePageAccess('verificacao_pedido');
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const pedido = await findPedido(pool, id);
  if (!pedido) notFound();

  // Fora destas duas, conferir não faz sentido: ou ninguém pediu ainda, ou o
  // pedido já seguiu adiante e a apuração já foi consumida pela aprovação.
  if (pedido.situacao !== 'cadastrado' && pedido.situacao !== 'verificando') {
    redirect(`/pedidos/${id}`);
  }

  const topo = pedido.itens.filter((item) => item.itemPaiId === null);
  const genericos = topo.filter((item) => item.generico);
  const especificos = topo.filter((item) => !item.generico);
  const respondidos = topo.filter((item) => item.disponivel !== null).length;
  const pendentes = topo.length - respondidos;

  const [especies, recipientes, escopos] = await Promise.all([
    genericos.length > 0 ? searchEspecies(pool) : [],
    listRecipientes(pool),
    Promise.all(genericos.map(async (item) => [item.id, await listEspeciesPermitidas(pool, item.id)] as const)),
  ]);
  const permitidasPor = new Map(escopos);

  const opcoesRecipiente = recipientes
    .filter((r) => r.ativo)
    .map((r) => ({ value: r.id, label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}` }));
  const opcoesEspecie = especies.filter((e) => e.ativa).map((e) => ({ value: e.id, label: nomeExibido(e) }));

  const porAbrir = pedido.situacao === 'cadastrado';

  return (
    <main>
      <PageHeader area="3 · Comercial" title={`Conferir pedido ${pedido.numero}`} />
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8">
        <Link href={`/pedidos/${id}`} className="text-base font-semibold text-brand-dark">
          Voltar ao pedido
        </Link>

        <section className="sticky top-0 z-10 flex flex-col gap-2 rounded-xl border border-line bg-white p-4 shadow-sm">
          <p className="text-base font-bold text-ink">{pedido.cliente}</p>
          <p className="text-base font-semibold text-ink">
            Respondidos: {respondidos} de {topo.length}
          </p>
          <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
            <div
              className="h-full bg-brand"
              style={{ width: topo.length ? `${(respondidos / topo.length) * 100}%` : '0%' }}
            />
          </div>
          {genericos.length > 0 && (
            <p className="text-sm text-muted">
              {especificos.length} com espécie · {genericos.length} sem espécie definida
            </p>
          )}
        </section>

        {porAbrir && (
          <Notice tone="info">
            A conferência ainda não foi aberta. Ao responder o primeiro item, o pedido passa a constar como em
            verificação.
          </Notice>
        )}

        {topo.length === 0 && <Notice tone="warning">Este pedido não tem item nenhum para conferir.</Notice>}

        <ul className="flex flex-col gap-3">
          {especificos.map((item) => (
            <VerificacaoItem
              key={item.id}
              pedidoId={pedido.id}
              item={{
                id: item.id,
                especie: item.especie ?? '',
                recipiente: item.recipiente,
                recipienteId: item.recipienteId,
                quantidade: item.quantidade,
                disponivel: item.disponivel,
                quantidadeDisponivel: item.quantidadeDisponivel,
                recipienteDisponivelId: item.recipienteDisponivelId,
                observacoesDisponibilidade: item.observacoesDisponibilidade,
              }}
              recipientes={opcoesRecipiente}
            />
          ))}

          {genericos.map((item) => (
            <ComposicaoGenerico
              key={item.id}
              pedidoId={pedido.id}
              item={{
                id: item.id,
                quantidade: item.quantidade,
                recipiente: item.recipiente,
                recipienteId: item.recipienteId,
                especificacao: item.especificacao,
                disponivel: item.disponivel,
                especiesPermitidas: permitidasPor.get(item.id) ?? [],
                filhos: pedido.itens
                  .filter((filho) => filho.itemPaiId === item.id)
                  .map((filho) => ({
                    id: filho.id,
                    especieId: filho.especieId ?? '',
                    especie: filho.especie ?? '',
                    recipienteId: filho.recipienteId,
                    recipiente: filho.recipiente,
                    quantidade: filho.quantidade,
                  })),
              }}
              especies={opcoesEspecie}
              recipientes={opcoesRecipiente}
            />
          ))}
        </ul>

        <AcoesVerificacao pedidoId={pedido.id} pendentes={pendentes} />
      </div>
    </main>
  );
}
