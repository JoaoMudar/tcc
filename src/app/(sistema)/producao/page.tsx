import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { type AtribuicaoResumo, SITUACOES_SEMANA, TOM_SEMANA, findSemana, listAgendaDia } from '@/lib/agenda';
import { formatData, hojeNoViveiro, isDataIso, somaDias } from '@/lib/datas';
import pool from '@/lib/db';
import { type Recurso, can } from '@/lib/permissions';
import { inicioDaSemana, nomeDia } from '@/lib/semanas';
import { formatDuracao, jornadaDiaria, listTurnos, turnoLabel } from '@/lib/turnos';
import { requirePageAccess } from '@/lib/auth/guards';
import { MapaProducao } from './MapaProducao';
import { ProducaoAbas } from './ProducaoAbas';
import { AtribuicaoCartao } from './agenda/AtribuicaoCartao';
import { EscalaAgenda } from './agenda/EscalaAgenda';

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
  searchParams: Promise<{ dia?: string; aba?: string }>;
}

/** T5.7, 2 · Produção: a agenda do dia e o mapa, em abas, e as demais rotinas abaixo. */
export default async function ProducaoPage({ searchParams }: ProducaoPageProps) {
  const { dia: diaPedido, aba } = await searchParams;
  const mapa = aba === 'mapa';
  // Cada aba tem o seu recurso na matriz do D4: o mapa é leitura dos três perfis
  const user = await requirePageAccess(mapa ? 'mapa_lotes' : 'agenda');
  const hoje = hojeNoViveiro();
  const dia = diaPedido && isDataIso(diaPedido) ? diaPedido : hoje;

  return (
    <main>
      <PageHeader area="2 · Produção" title={mapa ? 'Mapa de produção' : 'Agenda do dia'} />
      <ProducaoAbas aba={mapa ? 'mapa' : 'agenda'} />
      {/* O mapa pede a largura da tela: é a exceção declarada de RNF-14 */}
      <div className={`mx-auto flex ${mapa ? 'max-w-7xl' : 'max-w-5xl'} flex-col gap-4 p-4 md:p-8`}>
        {mapa ? (
          <MapaProducao />
        ) : (
          <AgendaDoDia dia={dia} hoje={hoje} podeLancar={can(user.perfil, 'agenda', 'C')} />
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

async function AgendaDoDia({ dia, hoje, podeLancar }: { dia: string; hoje: string; podeLancar: boolean }) {
  const semanaInicio = inicioDaSemana(dia);
  const [semana, turnos, atribuicoes] = await Promise.all([findSemana(pool, semanaInicio), listTurnos(pool), listAgendaDia(pool, dia)]);
  const ativos = turnos.filter((turno) => turno.ativo);
  // O turno desativado continua aparecendo no dia em que tem tarefa
  const grupos = turnos
    .map((turno) => ({ turno, tarefas: atribuicoes.filter((a) => a.turnoId === turno.id) }))
    .filter(({ turno, tarefas }) => turno.ativo || tarefas.length > 0);
  const aberta = semana?.situacao !== 'fechada';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EscalaAgenda escala="dia" dia={dia} />
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

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-ink">
            {nomeDia(dia)}, {formatData(dia)}
          </h2>
          {semana ? (
            <Pill tone={TOM_SEMANA[semana.situacao]}>Semana {SITUACOES_SEMANA[semana.situacao].toLowerCase()}</Pill>
          ) : (
            <Pill tone="neutral">Semana não aberta</Pill>
          )}
        </div>
        {/* TA-12: a jornada padrão sai do período de trabalho cadastrado, e não de constante */}
        <p className="text-sm text-muted">
          Jornada padrão {formatDuracao(jornadaDiaria(turnos))}
          {ativos.map((turno) => ` · ${turnoLabel(turno.nome)} ${turno.inicio} às ${turno.fim}`).join('')}
        </p>
      </div>

      {podeLancar && aberta && (
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
