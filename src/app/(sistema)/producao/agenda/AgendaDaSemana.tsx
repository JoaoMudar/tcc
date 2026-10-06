import { cookies } from 'next/headers';
import Link from 'next/link';
import { findSemana, listAgendaSemana, listFuncionarios } from '@/lib/agenda';
import { COOKIE_ZOOM, lerZoom } from '@/lib/agenda-zoom';
import { diasEntre } from '@/lib/datas';
import pool from '@/lib/db';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { SITUACOES_LOTE, listLotesDoMapa, pedemProvidencia, textoPendencia } from '@/lib/mapa';
import { horizonteProtocolo } from '@/lib/parametros';
import { type Perfil, can } from '@/lib/permissions';
import { listSugestoes, sugestoesDaSemana } from '@/lib/protocolos';
import { providenciaDoLote } from '@/lib/providencia';
import { diasDaSemana, diasUteisDaSemana, inicioDaSemana, rotuloSemana, semanaJaPassou } from '@/lib/semanas';
import { listTurnos } from '@/lib/turnos';
import { AgendaDiaCelular } from './AgendaDiaCelular';
import { ForaDaGrade } from './ForaDaGrade';
import { GanttSemana } from './GanttSemana';
import { NavegacaoAgenda } from './NavegacaoAgenda';
import { type ItemProvidencia, PedemProvidencia } from './PedemProvidencia';
import { SeletorZoom } from './SeletorZoom';
import { SugestoesProtocolo } from './SugestoesProtocolo';
import { ZoomAgenda } from './ZoomAgenda';
import { carregarOpcoes } from './opcoes';

interface AgendaDaSemanaProps {
  /** O dia escolhido: a semana é a dele, e no celular é o dia mostrado. */
  dia: string;
  hoje: string;
  perfil: Perfil;
}

/**
 * T5.1, F1 UC-19: a semana do dia escolhido. Gantt por pessoa no computador,
 * lista de um dia no celular (RNF-14). A semana não se abre nem se publica: nasce
 * aberta no primeiro lançamento, e o único ato sobre ela é fechar (RF-28, RN-14).
 */
export async function AgendaDaSemana({ dia, hoje, perfil }: AgendaDaSemanaProps) {
  const inicio = inicioDaSemana(dia);
  const dias = diasDaSemana(inicio);
  // O zoom Semana desenha só os dias úteis; sábado e domingo entram no 3 dias, no Dia e, com tarefa, no celular
  const diasUteis = diasUteisDaSemana(inicio);

  const [semana, funcionarios, turnos] = await Promise.all([findSemana(pool, inicio), listFuncionarios(pool), listTurnos(pool)]);
  const atribuicoes = semana ? await listAgendaSemana(pool, semana.id) : [];
  // RF-47: o protocolo sugere abaixo da semana, e não lança nada na grade.
  // A busca precisa alcançar o fim da semana, que pode estar além do horizonte;
  // quem recorta para a semana é sugestoesDaSemana.
  const horizonte = await horizonteProtocolo(pool);
  // O domingo fecha a semana (é o mesmo fim que sugestoesDaSemana usa)
  const fimDaSemana = dias[6];
  const diasAteOFim = diasEntre(hoje, fimDaSemana);
  const sugestoes = sugestoesDaSemana(await listSugestoes(pool, hoje, Math.max(horizonte, diasAteOFim, 0)), inicio, hoje);
  // RF-45, RF-66: o que pede providência, de qualquer semana. O lançamento cai na
  // semana aberta na tela, ou na de hoje quando a da tela já passou.
  const semanaDeLancar = semanaJaPassou(inicio, hoje) ? inicioDaSemana(hoje) : inicio;
  const providencias: ItemProvidencia[] = pedemProvidencia(await listLotesDoMapa(pool)).map((lote) => {
    const pendencia = textoPendencia(lote, hoje);
    return {
      loteId: lote.id,
      titulo: `${lote.codigo} · ${lote.especie}`,
      providencia: providenciaDoLote(lote, pendencia, semanaDeLancar),
      critico: lote.situacao === 'critico',
      situacao: SITUACOES_LOTE[lote.situacao],
      pendencia,
      saldo: `${formatQuantidade(lote.saldo)} mudas`,
    };
  });
  // O turno desativado continua com a sua faixa na semana em que tem tarefa
  const turnosNaGrade = turnos.filter((turno) => turno.ativo || atribuicoes.some((a) => a.turnoId === turno.id));

  const fechada = semana?.situacao === 'fechada';
  const podeMontar = can(perfil, 'agenda', 'C') && !fechada;
  // Semana que ainda não existe não tem o que fechar, e a corrente ainda não terminou (RF-28)
  const aFechar = semana?.situacao === 'aberta' && semanaJaPassou(inicio, hoje);
  const podeFechar = can(perfil, 'fechamento_semana', 'A') && aFechar;
  const podeArrastar = can(perfil, 'agenda', 'A') && !fechada;
  const podeConfirmar = can(perfil, 'confirmacao_tarefa', 'C') && !fechada;
  const noFimDeSemana = atribuicoes.filter((a) => !diasUteis.includes(a.data));
  const diasNoCelular = dias.filter((d) => diasUteis.includes(d) || noFimDeSemana.some((a) => a.data === d));
  // As listas do formulário só são buscadas para quem pode lançar clicando na grade
  const opcoes = podeMontar ? await carregarOpcoes(inicio) : undefined;
  const zoom = lerZoom((await cookies()).get(COOKIE_ZOOM)?.value);

  return (
    <ZoomAgenda inicial={zoom}>
      <section aria-labelledby="semana-titulo" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            <h2 id="semana-titulo" className="mr-2 text-lg font-semibold text-ink">
              Semana {rotuloSemana(inicio)}
            </h2>
            <NavegacaoAgenda dia={dia} hoje={hoje} />
            {turnosNaGrade.length > 0 && <SeletorZoom className="hidden md:flex" />}
            {fechada && <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">Fechada</span>}
          </div>
          <div className="flex items-center gap-1">
            {/* Um botão, e não um ⋯: sobrou uma ação só, e o <details> não abria no Firefox do celular */}
            {podeMontar && (
              <Link
                href={`/producao/agenda/nova?semana=${inicio}&dia=${dia}`}
                className="inline-flex min-h-11 items-center rounded-lg border-2 border-brand px-3 text-sm font-semibold text-brand active:bg-brand-light"
              >
                + Tarefa
              </Link>
            )}
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

        {atribuicoes.length === 0 && (
          <p className="rounded-lg border border-line bg-white p-6 text-sm text-muted md:p-4">Nenhuma tarefa nesta semana.</p>
        )}

        {/* O Gantt aparece mesmo vazio: é nele que se clica para lançar */}
        {turnosNaGrade.length > 0 && (
          <GanttSemana
            key={inicio}
            className="hidden md:block"
            atribuicoes={atribuicoes}
            funcionarios={funcionarios}
            dias={dias}
            turnos={turnosNaGrade}
            dia={dia}
            hoje={hoje}
            semana={inicio}
            podeArrastar={podeArrastar}
            aFechar={aFechar}
            opcoes={opcoes}
          />
        )}
        <ForaDaGrade atribuicoes={noFimDeSemana} />
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
            aFechar={aFechar}
            lancarHref={podeMontar ? `/producao/agenda/nova?semana=${inicio}&dia=${dia}` : undefined}
          />
        )}

        {/* Abaixo da semana, e nunca dentro da grade (RF-47) */}
        <SugestoesProtocolo sugestoes={sugestoes} semana={inicio} podeLancar={podeMontar} />
        <PedemProvidencia itens={providencias} podeAgir={can(perfil, 'agenda', 'C')} />
      </section>
    </ZoomAgenda>
  );
}
