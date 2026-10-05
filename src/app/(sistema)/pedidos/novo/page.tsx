import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { saldoDisponivel } from '@/lib/estoque';
import { listClientes } from '@/lib/pedidos';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { requirePageAccess } from '@/lib/auth/guards';
import { can } from '@/lib/permissions';
import { montarSaldos } from '@/components/pedidos/linhas-pedido';
import { NovoPedidoForm } from './NovoPedidoForm';

/**
 * T8.1, UC-31: o pedido já negociado por WhatsApp, registrado depois. O saldo de
 * cada item (RF-56) é lido aqui, na abertura da tela, e não fica gravado em
 * lugar nenhum.
 */
export default async function NovoPedidoPage() {
  const user = await requirePageAccess('pedidos', 'C');
  const [clientes, especies, recipientes, disponiveis] = await Promise.all([
    listClientes(pool),
    searchEspecies(pool),
    listRecipientes(pool),
    saldoDisponivel(pool),
  ]);

  const saldos = montarSaldos(disponiveis);

  // Sem espécie cadastrada não há o que pedir. Recipiente não trava: o item pode
  // nascer sem ele, e a conferência responde em qual a muda está
  const faltaCadastro = especies.length === 0;

  return (
    <main>
      <PageHeader area="3 · Comercial" title="Novo pedido" />
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8 lg:max-w-4xl">
        <Link href="/pedidos" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {faltaCadastro ? (
          <Notice tone="info">
            O item do pedido precisa de espécie cadastrada.{' '}
            <Link href="/cadastros" className="font-semibold underline">
              Abrir os cadastros
            </Link>
          </Notice>
        ) : (
          <NovoPedidoForm
            clientes={clientes.map((c) => ({ value: c.id, label: c.nome }))}
            // A colagem precisa de TODOS os nomes, e não só do de tela: é por
            // sinônimo e por científico que a linha do WhatsApp é reconhecida.
            especies={especies
              .filter((e) => e.ativa)
              .map((e) => ({
                id: e.id,
                nome: nomeExibido(e),
                nomeCientifico: e.nomeCientifico,
                nomesPopulares: e.nomesPopulares,
              }))}
            recipientes={recipientes
              .filter((r) => r.ativo)
              .map((r) => ({
                value: r.id,
                label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}`,
              }))}
            saldos={saldos}
            verFiscal={can(user.perfil, 'dados_fiscais', 'C')}
          />
        )}
      </div>
    </main>
  );
}
