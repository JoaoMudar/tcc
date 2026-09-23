import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import {
  SITUACOES_SEMANA,
  TOM_SEMANA,
  findSemana,
  listAgendaSemana,
  listFuncionarios,
  montarGrade,
} from '@/lib/agenda';
import { hojeNoViveiro, somaDias } from '@/lib/datas';
import pool from '@/lib/db';
import { horizonteProtocolo } from '@/lib/parametros';
import { can } from '@/lib/permissions';
import { listSugestoes, sugestoesDaSemana } from '@/lib/protocolos';
import { diaMes, diasDaSemana, diasUteisDaSemana, lerSemana, nomeDia, rotuloSemana } from '@/lib/semanas';
import { listTurnos } from '@/lib/turnos';
import { requirePageAccess } from '@/lib/auth/guards';
import { ProducaoAbas } from '../ProducaoAbas';
import { AcaoSemana } from './AcaoSemana';
import { AtribuicaoCartao } from './AtribuicaoCartao';
import { SugestoesProtocolo } from './SugestoesProtocolo';
import { EscalaAgenda } from './EscalaAgenda';
import { GanttSemana } from './GanttSemana';
import { carregarOpcoes } from './opcoes';

interface AgendaSemanaPageProps {
  searchParams: Promise<{ semana?: string; feito?: string }>;
}

const FEITO: Record<string, string> = {
  lancada: 'Tarefa lançada.',
  excluida: 'Tarefa excluída.',
  fechada: 'Semana fechada. O que ficou sem confirmação entrou como realizado, marcado de não confirmado.',
};

/** T5.1, F1 UC-19: linha do tempo por pessoa; no celular, lista por dia (RNF-14). */
export default async function AgendaSemanaPage({ searchParams }: AgendaSemanaPageProps) {
  const user = await requirePageAccess('agenda');
  const { semana: semanaPedida, feito } = await searchParams;
  const hoje = hojeNoViveiro();
  const inicio = lerSemana(semanaPedida, hoje);
  const dias = diasDaSemana(inicio);
  // A grade desenha só os dias úteis; o sábado continua na lista e no formulário
  const diasNaGrade = diasUteisDaSemana(inicio);

  const [semana, funcionarios, turnos] = await Promise.all([
    findSemana(pool, inicio),
    listFuncionarios(pool),
    listTurnos(pool),
  ]);
  const atribuicoes = semana ? await listAgendaSemana(pool, semana.id) : [];
  // RF-47: o protocolo sugere abaixo da semana, e não lança nada na grade.
  // A busca precisa alcançar o fim da semana aberta, que pode estar além do
  // horizonte; quem recorta para a semana é sugestoesDaSemana.
  const horizonte = await horizonteProtocolo(pool);
  // O domingo fecha a semana (é o mesmo fim que sugestoesDaSemana usa), e não o sábado da grade
  const fimDaSemana = somaDias(inicio, 6);
  const diasAteOFim = Math.round((Date.parse(`${fimDaSemana}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
  const sugestoes = sugestoesDaSemana(
    await listSugestoes(pool, hoje, Math.max(horizonte, diasAteOFim, 0)),
    inicio,
    hoje,
  );
  const grade = montarGrade(funcionarios, atribuicoes);
  const turnosEmUso = turnos.filter((turno) => turno.ativo);

  const podeMontar = can(user.perfil, 'agenda', 'C') && semana?.situacao !== 'fechada';
  const podePublicar = can(user.perfil, 'agenda', 'A') && semana?.situacao === 'rascunho';
  const podeFechar = can(user.perfil, 'fechamento_semana', 'A') && semana?.situacao === 'publicada';
  const diaReferencia = dias.includes(hoje) ? hoje : inicio;
  // As listas do formulário só são buscadas para quem pode lançar clicando na grade
  const podeArrastar = can(user.perfil, 'agenda', 'A') && semana?.situacao !== 'fechada';
  const foraDaGrade = atribuicoes.filter((a) => !diasNaGrade.includes(a.data));
  const opcoes = podeMontar ? await carregarOpcoes(inicio) : undefined;

  return (
    <main>
      <PageHeader area="2 · Produção" title={`Agenda · ${rotuloSemana(inicio)}`} />
      <ProducaoAbas aba="agenda" />
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EscalaAgenda escala="semana" dia={diaReferencia} />
          <nav aria-label="Trocar de semana" className="flex items-center gap-1 text-base font-semibold text-brand-dark">
            <Link href={`/producao/agenda?semana=${somaDias(inicio, -7)}`} className="inline-flex min-h-touch items-center px-3">
              ← Anterior
            </Link>
            <Link href={`/producao/agenda?semana=${somaDias(inicio, 7)}`} className="inline-flex min-h-touch items-center px-3">
              Próxima →
            </Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {semana ? (
            <Pill tone={TOM_SEMANA[semana.situacao]}>{SITUACOES_SEMANA[semana.situacao]}</Pill>
          ) : (
            <Pill tone="neutral">Não aberta</Pill>
          )}
          {feito && FEITO[feito] && <Notice tone="success">{FEITO[feito]}</Notice>}
        </div>

        {!semana && (
          <Notice tone="info">
            Esta semana ainda não foi aberta. Abrir traz as tarefas recorrentes da semana passada; copiar traz a semana passada inteira.
          </Notice>
        )}
        {semana?.situacao === 'fechada' && (
          <Notice tone="info">Semana fechada: não se altera mais. Correção, só por lançamento na semana seguinte.</Notice>
        )}

        {(podeMontar || podePublicar || podeFechar) && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {podeMontar && (
              <Link
                href={`/producao/agenda/nova?semana=${inicio}`}
                className="inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark"
              >
                + Lançar tarefa
              </Link>
            )}
            {podeMontar && !semana && <AcaoSemana acao="abrir" semana={inicio} />}
            {podeMontar && <AcaoSemana acao="copiar" semana={inicio} />}
            {podePublicar && <AcaoSemana acao="publicar" semana={inicio} />}
            {podeFechar && (
              <Link
                href={`/producao/agenda/fechar?semana=${inicio}`}
                className="inline-flex min-h-touch items-center justify-center rounded-xl border-2 border-brand bg-white px-5 text-base font-bold text-brand active:bg-brand-light"
              >
                Fechar a semana
              </Link>
            )}
          </div>
        )}

        {semana && grade.length === 0 && <Notice tone="info">Nenhuma tarefa lançada nesta semana.</Notice>}

        {grade.length > 0 && turnosEmUso.length > 0 && (
          <GanttSemana
            className="hidden md:block"
            grade={grade}
            dias={diasNaGrade}
            turnos={turnosEmUso}
            hoje={hoje}
            semana={inicio}
            podeArrastar={podeArrastar}
            opcoes={opcoes}
          />
        )}

        {foraDaGrade.length > 0 && (
          <div className="hidden md:block">
            <Notice tone="info">
              {foraDaGrade.length === 1 ? '1 tarefa está' : `${foraDaGrade.length} tarefas estão`} no sábado, que a grade da
              semana não desenha.{' '}
              <Link href={`/producao?dia=${dias[5]}`} className="font-semibold underline underline-offset-2">
                Ver o sábado
              </Link>
              .
            </Notice>
          </div>
        )}

        {atribuicoes.length > 0 && (
          <div className="flex flex-col gap-5 md:hidden">
            {dias.map((dia) => {
              const doDia = atribuicoes.filter((a) => a.data === dia);
              return (
                <section key={dia} className="flex flex-col gap-2">
                  {/* A divisória sob o nome fecha o dia: sem ela a lista lê como uma pilha só. */}
                  <h2
                    className={`border-b pb-1 text-sm font-bold tracking-widest uppercase ${
                      dia === hoje ? 'border-brand-muted text-brand-dark' : 'border-line text-muted'
                    }`}
                  >
                    {nomeDia(dia)} · {diaMes(dia)}
                  </h2>
                  {doDia.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line p-3 text-base text-muted">Nada lançado.</p>
                  ) : (
                    doDia.map((a) => <AtribuicaoCartao key={a.id} atribuicao={a} mostrarTurno />)
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Abaixo da semana, e nunca dentro da grade (RF-47) */}
        <SugestoesProtocolo sugestoes={sugestoes} semana={inicio} podeLancar={podeMontar} />
      </div>
    </main>
  );
}
