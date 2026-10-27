import Link from 'next/link';
import { AvisosNoCelular } from '@/components/AvisosNoCelular';
import { PageHeader } from '@/components/PageHeader';
import { Toast } from '@/components/ui/Toast';
import { pedidosDoPeriodo } from '@/lib/cargas';
import { hojeNoViveiro, somaDias } from '@/lib/datas';
import pool from '@/lib/db';
import { chavePublicaVapid } from '@/lib/notificacoes-envio';
import { listPedidos } from '@/lib/pedidos';
import { can } from '@/lib/permissions';
import { diasComViagemPronta, viagensEmAndamento } from '@/lib/viagens';
import { requirePageAccess } from '@/lib/auth/guards';
import { desinscreverAparelhoAction, inscreverAparelhoAction } from '../conta/sessoes/actions';
import { CalendarioCargas } from './CalendarioCargas';
import { ListaPedidos } from './ListaPedidos';

interface PedidosPageProps {
  searchParams: Promise<{ feito?: string; numero?: string; cliente?: string; q?: string; mes?: string }>;
}

/** T8.4, RF-60: a carteira de pedidos, com o filtro de cliente que se digita. */
export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  // TA-03: a gerência que digita este endereço cai em /sem-permissao
  const user = await requirePageAccess('pedidos');
  const hoje = hojeNoViveiro();
  const params = await searchParams;

  // O calendário cobre o mês inteiro: quem carrega caminhão planeja o mês.
  // RF-68: e navega entre meses pelo endereço (`?mes=AAAA-MM`)
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? `${params.mes}-01` : `${hoje.slice(0, 7)}-01`;
  const fimDoMes = somaDias(`${somaDias(mes, 31).slice(0, 7)}-01`, -1);

  const inicioDoPeriodo = somaDias(mes, -7);
  const [lista, doMes, viagens, diasProntos] = await Promise.all([
    // RF-60: o filtro de cliente vai ao banco, e acha também o pedido antigo
    listPedidos(pool, { clienteId: params.cliente ?? null, texto: params.q ?? '' }),
    // Até três dias depois do mês: a entrega de segunda carrega na sexta anterior
    pedidosDoPeriodo(pool, inicioDoPeriodo, somaDias(fimDoMes, 3)),
    viagensEmAndamento(pool),
    diasComViagemPronta(pool, inicioDoPeriodo, fimDoMes),
  ]);
  // O calendário é ferramenta de quem separa, e a chefia também o usa para saber
  // o que está por sair. Quem não mexe em carga não o vê.
  const veCalendario = can(user.perfil, 'cargas_pedido', 'L');

  return (
    <main>
      <PageHeader area="3 · Comercial" title="Pedidos" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        {/* O pedido recém-cadastrado traz a pessoa de volta para cá, e o aviso
            do que aconteceu some sozinho: quem registra um já vai registrar o
            seguinte, e um banner fixo só ocuparia a tela do celular. */}
        {params.feito === 'criado' && (
          <Toast tone="success" limpar={['feito', 'numero']}>
            Pedido {params.numero ?? ''} registrado. O preço entra depois da conferência.
          </Toast>
        )}

        {/* Some sozinho depois de ligado ou dispensado; o controle fica em Aparelhos conectados */}
        <AvisosNoCelular
          aparencia="convite"
          chavePublica={chavePublicaVapid()}
          inscreverAction={inscreverAparelhoAction}
          desinscreverAction={desinscreverAparelhoAction}
        />

        {can(user.perfil, 'pedidos', 'C') && (
          <Link
            href="/pedidos/novo"
            className="flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark"
          >
            Novo pedido
          </Link>
        )}

        {veCalendario && (
          <CalendarioCargas
            mes={mes}
            hoje={hoje}
            viagens={viagens}
            diasProntos={diasProntos}
            pedidos={doMes}
          />
        )}

        <ListaPedidos pedidos={lista} hoje={hoje} filtroInicial={{ clienteId: params.cliente ?? '', texto: params.q ?? '' }} />
      </div>
    </main>
  );
}
