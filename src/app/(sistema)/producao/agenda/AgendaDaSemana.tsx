import Link from 'next/link';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import { SITUACOES_SEMANA, TOM_SEMANA, findSemana, listAgendaSemana, listFuncionarios, montarGrade } from '@/lib/agenda';
import { somaDias } from '@/lib/datas';
import pool from '@/lib/db';
import { horizonteProtocolo } from '@/lib/parametros';
import { type Perfil, can } from '@/lib/permissions';
import { listSugestoes, sugestoesDaSemana } from '@/lib/protocolos';
import { diaMes, diasDaSemana, diasUteisDaSemana, inicioDaSemana, nomeDia, rotuloSemana } from '@/lib/semanas';
import { listTurnos } from '@/lib/turnos';
import { AtribuicaoCartao } from './AtribuicaoCartao';
import { CopiarSemanaForm } from './CopiarSemanaForm';
import { GanttSemana } from './GanttSemana';
import { SugestoesProtocolo } from './SugestoesProtocolo';
import { carregarOpcoes } from './opcoes';

interface AgendaDaSemanaProps {
  /** O dia de cima: a semana é a dele. */
  dia: string;
  hoje: string;
  perfil: Perfil;
}

/**
 * T5.1, F1 UC-19: a semana do dia escolhido, logo abaixo dele. Linha do tempo por
 * pessoa no computador; no celular, lista por dia (RNF-14). A semana não se abre
 * nem se publica: nasce aberta no primeiro lançamento, e o único ato sobre ela é
 * fechar (RF-28, RN-14).
 */
export async function AgendaDaSemana({ dia, hoje, perfil }: AgendaDaSemanaProps) {
  const inicio = inicioDaSemana(dia);
  const dias = diasDaSemana(inicio);
  // A grade desenha só os dias úteis; o sábado continua na lista e no formulário
  const diasNaGrade = diasUteisDaSemana(inicio);

  const [semana, funcionarios, turnos] = await Promise.all([findSemana(pool, inicio), listFuncionarios(pool), listTurnos(pool)]);
  const atribuicoes = semana ? await listAgendaSemana(pool, semana.id) : [];
  // RF-47: o protocolo sugere abaixo da semana, e não lança nada na grade.
  // A busca precisa alcançar o fim da semana, que pode estar além do horizonte;
  // quem recorta para a semana é sugestoesDaSemana.
  const horizonte = await horizonteProtocolo(pool);
  // O domingo fecha a semana (é o mesmo fim que sugestoesDaSemana usa), e não o sábado da grade
  const fimDaSemana = somaDias(inicio, 6);
  const diasAteOFim = Math.round((Date.parse(`${fimDaSemana}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
  const sugestoes = sugestoesDaSemana(await listSugestoes(pool, hoje, Math.max(horizonte, diasAteOFim, 0)), inicio, hoje);
  const grade = montarGrade(funcionarios, atribuicoes);
  const turnosEmUso = turnos.filter((turno) => turno.ativo);

  const fechada = semana?.situacao === 'fechada';
  const podeMontar = can(perfil, 'agenda', 'C') && !fechada;
  // Semana que ainda não existe não tem o que fechar
  const podeFechar = can(perfil, 'fechamento_semana', 'A') && semana?.situacao === 'aberta';
  // As listas do formulário só são buscadas para quem pode lançar clicando na grade
  const podeArrastar = can(perfil, 'agenda', 'A') && !fechada;
  const foraDaGrade = atribuicoes.filter((a) => !diasNaGrade.includes(a.data));
  const opcoes = podeMontar ? await carregarOpcoes(inicio) : undefined;

  return (
    <section aria-labelledby="semana-titulo" className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="semana-titulo" className="text-xl font-bold text-ink">
            Semana de {rotuloSemana(inicio)}
          </h2>
          <Pill tone={TOM_SEMANA[semana?.situacao ?? 'aberta']}>{SITUACOES_SEMANA[semana?.situacao ?? 'aberta']}</Pill>
        </div>
        <nav aria-label="Trocar de semana" className="flex items-center gap-1 text-base font-semibold text-brand-dark">
          <Link href={`/producao?dia=${somaDias(dia, -7)}`} className="inline-flex min-h-touch items-center px-3">
            ← Semana anterior
          </Link>
          <Link href={`/producao?dia=${somaDias(dia, 7)}`} className="inline-flex min-h-touch items-center px-3">
            Próxima semana →
          </Link>
        </nav>
      </div>

      {fechada && <Notice tone="info">Semana fechada: não se altera mais. Correção, só por lançamento na semana seguinte.</Notice>}

      {(podeMontar || podeFechar) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {podeMontar && <CopiarSemanaForm semana={inicio} />}
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

      {grade.length === 0 && <Notice tone="info">Nenhuma tarefa lançada nesta semana.</Notice>}

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
          {dias.map((d) => {
            const doDia = atribuicoes.filter((a) => a.data === d);
            return (
              <section key={d} className="flex flex-col gap-2">
                {/* A divisória sob o nome fecha o dia: sem ela a lista lê como uma pilha só. */}
                <h3
                  className={`border-b pb-1 text-sm font-bold tracking-widest uppercase ${
                    d === hoje ? 'border-brand-muted text-brand-dark' : 'border-line text-muted'
                  }`}
                >
                  <Link href={`/producao?dia=${d}`}>
                    {nomeDia(d)} · {diaMes(d)}
                  </Link>
                </h3>
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
    </section>
  );
}
