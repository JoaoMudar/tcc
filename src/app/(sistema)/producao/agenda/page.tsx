import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import {
  type AtribuicaoResumo,
  SITUACOES_ATRIBUICAO,
  SITUACOES_SEMANA,
  TOM_SEMANA,
  findSemana,
  formatHoraTarefa,
  listAgendaSemana,
  listFuncionarios,
  montarGrade,
  siglaTurno,
} from '@/lib/agenda';
import { hojeNoViveiro, somaDias } from '@/lib/datas';
import pool from '@/lib/db';
import { can } from '@/lib/permissions';
import { diaMes, diasDaSemana, lerSemana, nomeDia, rotuloSemana, siglaDia } from '@/lib/semanas';
import { requirePageAccess } from '@/lib/auth/guards';
import { ProducaoAbas } from '../ProducaoAbas';
import { AcaoSemana } from './AcaoSemana';
import { AtribuicaoCartao } from './AtribuicaoCartao';
import { EscalaAgenda } from './EscalaAgenda';

interface AgendaSemanaPageProps {
  searchParams: Promise<{ semana?: string; feito?: string }>;
}

const FEITO: Record<string, string> = {
  lancada: 'Tarefa lançada.',
  excluida: 'Tarefa excluída.',
  fechada: 'Semana fechada. O que ficou sem confirmação entrou como realizado, marcado de não confirmado.',
};

/** Cor da borda da célula pela situação: a não confirmada fica à vista (RN-14). */
const BORDA: Record<AtribuicaoResumo['situacao'], string> = {
  planejada: 'border-l-gray-300',
  confirmada: 'border-l-green-600',
  nao_confirmada: 'border-l-amber-500',
  cancelada: 'border-l-red-400',
};

/** T5.1, F1 UC-19: pessoas nas linhas, dias nas colunas; no celular, lista por dia (RNF-14). */
export default async function AgendaSemanaPage({ searchParams }: AgendaSemanaPageProps) {
  const user = await requirePageAccess('agenda');
  const { semana: semanaPedida, feito } = await searchParams;
  const hoje = hojeNoViveiro();
  const inicio = lerSemana(semanaPedida, hoje);
  const dias = diasDaSemana(inicio);

  const [semana, funcionarios] = await Promise.all([findSemana(pool, inicio), listFuncionarios(pool)]);
  const atribuicoes = semana ? await listAgendaSemana(pool, semana.id) : [];
  const grade = montarGrade(funcionarios, atribuicoes);

  const podeMontar = can(user.perfil, 'agenda', 'C') && semana?.situacao !== 'fechada';
  const podePublicar = can(user.perfil, 'agenda', 'A') && semana?.situacao === 'rascunho';
  const podeFechar = can(user.perfil, 'fechamento_semana', 'A') && semana?.situacao === 'publicada';
  const diaReferencia = dias.includes(hoje) ? hoje : inicio;

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

        {grade.length > 0 && (
          <table className="hidden w-full table-fixed border-collapse text-sm md:table">
            <thead>
              <tr>
                <th className="w-36 p-2 text-left text-xs font-bold tracking-widest text-muted uppercase">Pessoa</th>
                {dias.map((dia) => (
                  <th key={dia} className={`p-2 text-left text-xs font-bold tracking-widest uppercase ${dia === hoje ? 'text-brand-dark' : 'text-muted'}`}>
                    <Link href={`/producao?dia=${dia}`} className="underline-offset-2 hover:underline">
                      {siglaDia(dia)} {diaMes(dia)}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grade.map((linha) => (
                <tr key={linha.pessoa?.id ?? 'sem-ninguem'} className="border-t border-line align-top">
                  <th scope="row" className="p-2 text-left text-base font-semibold text-ink">
                    {linha.pessoa?.nome ?? <span className="text-muted">Sem ninguém</span>}
                  </th>
                  {dias.map((dia) => (
                    <td key={dia} className="p-1">
                      <div className="flex flex-col gap-1">
                        {(linha.porDia[dia] ?? []).map((a) => (
                          <Link
                            key={a.id}
                            href={`/producao/agenda/${a.id}`}
                            title={SITUACOES_ATRIBUICAO[a.situacao]}
                            className={`flex flex-col rounded-md border border-l-4 border-line bg-white px-2 py-1 hover:bg-brand-light ${BORDA[a.situacao]}`}
                          >
                            <span className="truncate font-semibold text-ink">{a.tipo}</span>
                            <span className="truncate text-xs text-muted">
                              {[siglaTurno(a.turno), formatHoraTarefa(a.horaInicio, a.horaFim), a.loteCodigo ?? a.especie ?? a.area]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {atribuicoes.length > 0 && (
          <div className="flex flex-col gap-5 md:hidden">
            {dias.map((dia) => {
              const doDia = atribuicoes.filter((a) => a.data === dia);
              return (
                <section key={dia} className="flex flex-col gap-2">
                  <h2 className="text-sm font-bold tracking-widest text-muted uppercase">
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
      </div>
    </main>
  );
}
