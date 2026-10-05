import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Toast } from '@/components/ui/Toast';
import { hojeNoViveiro, isDataIso } from '@/lib/datas';
import { CAUSAS_PERDA, formatQuantidade, isCausaPerda, lerQuantidade } from '@/lib/lotes-rotulos';
import { type Recurso, can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';
import { MapaProducao } from './MapaProducao';
import { ProducaoAbas } from './ProducaoAbas';
import { AgendaDaSemana } from './agenda/AgendaDaSemana';

const SECOES: readonly { href: string; title: string; description: string; recurso: Recurso }[] = [
  {
    href: '/producao/lotes',
    title: 'Lotes',
    description: 'O viveiro por área e canteiro: o que tem em cada um, e os livres.',
    recurso: 'lotes',
  },
  { href: '/producao/perdas', title: 'Perdas', description: 'Perdas por período, espécie e causa, e a mortalidade de cada lote.', recurso: 'analise_perdas' },
  { href: '/producao/saldo', title: 'Estoque disponível', description: 'Quanto há para vender, por espécie, recipiente e altura.', recurso: 'estoque_disponivel' },
];

interface ProducaoPageProps {
  searchParams: Promise<{ dia?: string; aba?: string; feito?: string; perda?: string; causa?: string; }>;
}

const FEITO: Record<string, string> = {
  lancada: 'Tarefa lançada.',
  alterada: 'Tarefa alterada.',
  confirmada: 'Tarefa confirmada.',
  excluida: 'Tarefa excluída.',
  fechada: 'Semana fechada. O que ficou sem confirmação entrou como realizado, marcado de não confirmado.',
};

/**
 * T5.7, 2 · Produção: a agenda e o mapa, em abas, e as demais rotinas abaixo. A
 * agenda é uma tela só: a semana inteira no computador, e o dia dela no celular.
 */
export default async function ProducaoPage({ searchParams }: ProducaoPageProps) {
  const { dia: diaPedido, aba, feito, perda, causa } = await searchParams;
  const mapa = aba === 'mapa';
  // Cada aba tem o seu recurso na matriz do D4: o mapa é leitura dos três perfis
  const user = await requirePageAccess(mapa ? 'mapa_lotes' : 'agenda');
  const hoje = hojeNoViveiro();
  const dia = diaPedido && isDataIso(diaPedido) ? diaPedido : hoje;
  // A confirmação que registrou mudas mortas diz isso junto (UC-20)
  const perdaRegistrada = feito === 'confirmada' ? lerQuantidade(perda ?? '') : null;
  const avisoPerda =
    perdaRegistrada !== null && causa && isCausaPerda(causa)
      ? ` Perda de ${formatQuantidade(perdaRegistrada)} por ${CAUSAS_PERDA[causa].toLowerCase()} registrada no lote.`
      : '';
  const avisoFeito = feito ? FEITO[feito] : undefined;

  return (
    <main>
      <PageHeader area="2 · Produção" title={mapa ? 'Mapa de produção' : 'Agenda'} />
      <ProducaoAbas aba={mapa ? 'mapa' : 'agenda'} />
      {/* O mapa e a grade da semana pedem a largura da tela: é a exceção declarada de RNF-14 */}
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-8">
        {mapa ? (
          <MapaProducao />
        ) : (
          <>
            {avisoFeito && (
              <Toast tone="success" limpar={['feito', 'perda', 'causa']}>
                {avisoFeito}
                {avisoPerda}
              </Toast>
            )}
            <AgendaDaSemana dia={dia} hoje={hoje} perfil={user.perfil} />
          </>
        )}

        <h2 className="mt-4 text-sm font-bold tracking-widest text-muted uppercase">Demais rotinas da produção</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {SECOES.filter((secao) => can(user.perfil, secao.recurso, 'L')).map((secao) => (
            <Link
              key={secao.href}
              href={secao.href}
              className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4 active:bg-brand-light"
            >
              <span className="text-lg font-semibold text-ink">{secao.title}</span>
              <span className="text-sm text-muted">{secao.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
