import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { type AtribuicaoResumo, findSemana, listAgendaDia } from '@/lib/agenda';
import { formatData, hojeNoViveiro, isDataIso, somaDias } from '@/lib/datas';
import pool from '@/lib/db';
import { type Perfil, type Recurso, can } from '@/lib/permissions';
import { inicioDaSemana, nomeDia } from '@/lib/semanas';
import { formatDuracao, jornadaDiaria, listTurnos, turnoLabel } from '@/lib/turnos';
import { requirePageAccess } from '@/lib/auth/guards';
import { MapaProducao } from './MapaProducao';
import { ProducaoAbas } from './ProducaoAbas';
import { AgendaDaSemana } from './agenda/AgendaDaSemana';
import { AtribuicaoCartao } from './agenda/AtribuicaoCartao';

const SECOES: readonly { href: string; title: string; description: string; recurso: Recurso }[] = [
  {
    href: '/producao/lotes',
    title: 'Lotes',
    description: 'O viveiro por área e canteiro: o que tem em cada um, e os livres.',
    recurso: 'lotes',
  },
  { href: '/producao/perdas', title: 'Perdas', description: 'Perdas por período, espécie e causa, e a mortalidade de cada lote.', recurso: 'analise_perdas' },
  { href: '/producao/saldo', title: 'Muda pronta', description: 'Quanto há pronto para vender, por espécie e recipiente.', recurso: 'estoque_disponivel' },
];

interface ProducaoPageProps {
  searchParams: Promise<{ dia?: string; aba?: string; feito?: string }>;
}

const FEITO: Record<string, string> = {
  lancada: 'Tarefa lançada.',
  excluida: 'Tarefa excluída.',
  fechada: 'Semana fechada. O que ficou sem confirmação entrou como realizado, marcado de não confirmado.',
};

/**
 * T5.7, 2 · Produção: a agenda e o mapa, em abas, e as demais rotinas abaixo. A
 * agenda é uma tela só: o dia em cima e a semana dele embaixo, sem trocar de escala.
 */
export default async function ProducaoPage({ searchParams }: ProducaoPageProps) {
  const { dia: diaPedido, aba, feito } = await searchParams;
  const mapa = aba === 'mapa';
  // Cada aba tem o seu recurso na matriz do D4: o mapa é leitura dos três perfis
  const user = await requirePageAccess(mapa ? 'mapa_lotes' : 'agenda');
  const hoje = hojeNoViveiro();
  const dia = diaPedido && isDataIso(diaPedido) ? diaPedido : hoje;

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
            {feito && FEITO[feito] && <Notice tone="success">{FEITO[feito]}</Notice>}
            <AgendaDoDia dia={dia} hoje={hoje} perfil={user.perfil} />
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

async function AgendaDoDia({ dia, hoje, perfil }: { dia: string; hoje: string; perfil: Perfil }) {
  const semanaInicio = inicioDaSemana(dia);
  const [semana, turnos, atribuicoes] = await Promise.all([findSemana(pool, semanaInicio), listTurnos(pool), listAgendaDia(pool, dia)]);
  const ativos = turnos.filter((turno) => turno.ativo);
  // O turno desativado continua aparecendo no dia em que tem tarefa
  const grupos = turnos
    .map((turno) => ({ turno, tarefas: atribuicoes.filter((a) => a.turnoId === turno.id) }))
    .filter(({ turno, tarefas }) => turno.ativo || tarefas.length > 0);
  const podeLancar = can(perfil, 'agenda', 'C') && semana?.situacao !== 'fechada';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">
          {nomeDia(dia)}, {formatData(dia)}
        </h2>
        <nav aria-label="Trocar de dia" className="flex items-center gap-1 text-base font-semibold text-brand-dark">
          <Link href={`/producao?dia=${somaDias(dia, -1)}`} className="inline-flex min-h-touch items-center px-3">
            ← Anterior
          </Link>
          {dia !== hoje && (
            <Link href="/producao" className="inline-flex min-h-touch items-center px-3">
              Hoje
            </Link>
          )}
          <Link href={`/producao?dia=${somaDias(dia, 1)}`} className="inline-flex min-h-touch items-center px-3">
            Próximo →
          </Link>
        </nav>
      </div>

      {/* TA-12: a jornada padrão sai do período de trabalho cadastrado, e não de constante */}
      <p className="-mt-2 text-sm text-muted">
        Jornada padrão {formatDuracao(jornadaDiaria(turnos))}
        {ativos.map((turno) => ` · ${turnoLabel(turno.nome)} ${turno.inicio} às ${turno.fim}`).join('')}
      </p>

      {podeLancar && (
        <Link
          href={`/producao/agenda/nova?semana=${semanaInicio}&dia=${dia}`}
          className="inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark md:self-start"
        >
          + Lançar tarefa
        </Link>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {grupos.map(({ turno, tarefas }) => (
          <section key={turno.id} className="flex flex-col gap-2">
            <h3 className="text-sm font-bold tracking-widest text-muted uppercase">
              {turnoLabel(turno.nome)} · {turno.inicio} às {turno.fim}
            </h3>
            {tarefas.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-3 text-base text-muted">Nada lançado.</p>
            ) : (
              tarefas.map((tarefa: AtribuicaoResumo) => <AtribuicaoCartao key={tarefa.id} atribuicao={tarefa} />)
            )}
          </section>
        ))}
      </div>
    </>
  );
}
