import Link from 'next/link';
import { findSemana, listAgendaSemana, listFuncionarios } from '@/lib/agenda';
import { somaDias } from '@/lib/datas';
import pool from '@/lib/db';
import { horizonteProtocolo } from '@/lib/parametros';
import { type Perfil, can } from '@/lib/permissions';
import { listSugestoes, sugestoesDaSemana } from '@/lib/protocolos';
import { diasDaSemana, diasUteisDaSemana, inicioDaSemana, rotuloSemana } from '@/lib/semanas';
import { formatDuracao, jornadaDiaria, listTurnos, turnoLabel } from '@/lib/turnos';
import { AgendaDiaCelular } from './AgendaDiaCelular';
import { CopiarSemanaForm } from './CopiarSemanaForm';
import { GanttSemana } from './GanttSemana';
import { MenuSemana } from './MenuSemana';
import { SugestoesProtocolo } from './SugestoesProtocolo';
import { carregarOpcoes } from './opcoes';

interface AgendaDaSemanaProps {
  /** O dia escolhido: a semana é a dele, e no celular é o dia mostrado. */
  dia: string;
  hoje: string;
  perfil: Perfil;
}

const LINK_NAV = 'inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-2 text-base text-muted hover:bg-surface hover:text-ink';

/**
 * T5.1, F1 UC-19: a semana do dia escolhido. Gantt por pessoa no computador,
 * lista de um dia no celular (RNF-14). A semana não se abre nem se publica: nasce
 * aberta no primeiro lançamento, e o único ato sobre ela é fechar (RF-28, RN-14).
 */
export async function AgendaDaSemana({ dia, hoje, perfil }: AgendaDaSemanaProps) {
  const inicio = inicioDaSemana(dia);
  const dias = diasDaSemana(inicio);
  // A grade desenha só os dias úteis; o sábado entra no celular quando tem tarefa
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
  const ativos = turnos.filter((turno) => turno.ativo);
  // O turno desativado continua com a sua faixa na semana em que tem tarefa
  const turnosNaGrade = turnos.filter((turno) => turno.ativo || atribuicoes.some((a) => a.turnoId === turno.id));

  const fechada = semana?.situacao === 'fechada';
  const podeMontar = can(perfil, 'agenda', 'C') && !fechada;
  // Semana que ainda não existe não tem o que fechar
  const podeFechar = can(perfil, 'fechamento_semana', 'A') && semana?.situacao === 'aberta';
  const podeArrastar = can(perfil, 'agenda', 'A') && !fechada;
  const podeConfirmar = can(perfil, 'confirmacao_tarefa', 'C') && !fechada;
  const noSabado = atribuicoes.filter((a) => a.data === dias[5]);
  const diasNoCelular = noSabado.length > 0 ? dias.slice(0, 6) : diasNaGrade;
  // As listas do formulário só são buscadas para quem pode lançar clicando na grade
  const opcoes = podeMontar ? await carregarOpcoes(inicio) : undefined;

  return (
    <section aria-labelledby="semana-titulo" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <h2 id="semana-titulo" className="mr-2 text-lg font-semibold text-ink">
            Semana {rotuloSemana(inicio)}
          </h2>
          <nav aria-label="Trocar de semana" className="flex items-center">
            <Link href={`/producao?dia=${somaDias(dia, -7)}`} aria-label="Semana anterior" title="Semana anterior (←)" className={LINK_NAV}>
              ‹
            </Link>
            <Link href={`/producao?dia=${somaDias(dia, 7)}`} aria-label="Próxima semana" title="Próxima semana (→)" className={LINK_NAV}>
              ›
            </Link>
            {dia !== hoje && (
              <Link href="/producao" title="Voltar para hoje (T)" className={`${LINK_NAV} text-sm font-semibold`}>
                Hoje
              </Link>
            )}
          </nav>
          {fechada && <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">Fechada</span>}
        </div>
        <div className="flex items-center gap-1">
          <MenuSemana semana={inicio} dia={dia} podeMontar={podeMontar} />
          {podeFechar && (
            <Link
              href={`/producao/agenda/fechar?semana=${inicio}`}
              className="inline-flex min-h-11 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-white active:bg-brand-dark"
            >
              Fechar semana
            </Link>
          )}
        </div>
      </div>

      {/* TA-12: a jornada sai do período de trabalho cadastrado, e explica as faixas da grade */}
      <p className="-mt-2 text-xs text-muted">
        Jornada {formatDuracao(jornadaDiaria(turnos))}
        {ativos.map((turno) => ` · ${turnoLabel(turno.nome)} ${turno.inicio}–${turno.fim}`).join('')}
        {fechada && ' · Semana fechada: correção, só por lançamento na semana seguinte.'}
      </p>

      {atribuicoes.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-white p-6 md:flex-row md:items-center md:p-4">
          <p className="text-sm text-muted">Nenhuma tarefa nesta semana.</p>
          {podeMontar && <CopiarSemanaForm semana={inicio} estilo="vazio" />}
        </div>
      )}

      {/* O Gantt aparece mesmo vazio: é nele que se clica para lançar */}
      {turnosNaGrade.length > 0 && (
        <GanttSemana
          key={inicio}
          className="hidden md:block"
          atribuicoes={atribuicoes}
          funcionarios={funcionarios}
          dias={diasNaGrade}
          turnos={turnosNaGrade}
          hoje={hoje}
          semana={inicio}
          anterior={`/producao?dia=${somaDias(dia, -7)}`}
          proxima={`/producao?dia=${somaDias(dia, 7)}`}
          podeArrastar={podeArrastar}
          opcoes={opcoes}
        />
      )}
      {noSabado.length > 0 && (
        <p className="hidden text-sm text-muted md:block">
          No sábado, fora da grade:{' '}
          {noSabado.map((a, indice) => (
            <span key={a.id}>
              {indice > 0 && ', '}
              <Link href={`/producao/agenda/${a.id}`} className="font-medium text-brand-dark underline-offset-2 hover:underline">
                {a.tipo}
              </Link>
            </span>
          ))}
          .
        </p>
      )}
      {atribuicoes.length > 0 && (
        <AgendaDiaCelular
          className="md:hidden"
          atribuicoes={atribuicoes}
          funcionarios={funcionarios}
          dias={diasNoCelular}
          dia={dia}
          hoje={hoje}
          turnos={turnosNaGrade}
          podeConfirmar={podeConfirmar}
          podeAlterar={podeArrastar}
          lancarHref={podeMontar ? `/producao/agenda/nova?semana=${inicio}&dia=${dia}` : undefined}
        />
      )}

      {/* Abaixo da semana, e nunca dentro da grade (RF-47) */}
      <SugestoesProtocolo sugestoes={sugestoes} semana={inicio} podeLancar={podeMontar} />
    </section>
  );
}
