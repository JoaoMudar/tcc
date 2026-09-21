import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { saldoEmProducao, saldoPronto } from '@/lib/estoque';
import { listClientes } from '@/lib/pedidos';
import { chaveSaldo } from '@/lib/pedidos-rotulos';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { requirePageAccess } from '@/lib/auth/guards';
import { NovoPedidoForm, type SaldosPorChave } from './NovoPedidoForm';

/**
 * T8.1, UC-31: o pedido já negociado por WhatsApp, registrado depois. O saldo de
 * cada item (RF-56) é lido aqui, na abertura da tela, e não fica gravado em
 * lugar nenhum.
 */
export default async function NovoPedidoPage() {
  await requirePageAccess('pedidos', 'C');
  const [clientes, especies, recipientes, prontos, producao] = await Promise.all([
    listClientes(pool),
    searchEspecies(pool),
    listRecipientes(pool),
    saldoPronto(pool),
    saldoEmProducao(pool),
  ]);

  const saldos: SaldosPorChave = {};
  for (const linha of prontos) {
    saldos[chaveSaldo(linha.especieId, linha.recipienteId)] = { pronto: linha.quantidade, producao: 0 };
  }
  for (const linha of producao) {
    const chave = chaveSaldo(linha.especieId, linha.recipienteId);
    saldos[chave] = { pronto: saldos[chave]?.pronto ?? 0, producao: linha.quantidade };
  }

  const faltaCadastro = especies.length === 0 || recipientes.filter((r) => r.ativo).length === 0;

  return (
    <main>
      <PageHeader area="3 · Comercial" title="Novo pedido" />
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8">
        <Link href="/pedidos" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {faltaCadastro ? (
          <Notice tone="info">
            O item do pedido precisa de espécie e recipiente cadastrados.{' '}
            <Link href="/cadastros" className="font-semibold underline">
              Abrir os cadastros
            </Link>
          </Notice>
        ) : (
          <NovoPedidoForm
            clientes={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            especies={especies.filter((e) => e.ativa).map((e) => ({ value: e.id, label: nomeExibido(e) }))}
            recipientes={recipientes
              .filter((r) => r.ativo)
              .map((r) => ({
                value: r.id,
                label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}`,
              }))}
            saldos={saldos}
          />
        )}
      </div>
    </main>
  );
}
