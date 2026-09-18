import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import { ESTADOS_TAREFA, TOM_ESTADO, estadoTarefa, findAtribuicao, formatHoraTarefa, formatQuantidadeMedida } from '@/lib/agenda';
import { listAreas } from '@/lib/areas';
import { formatData } from '@/lib/datas';
import pool from '@/lib/db';
import { CAUSAS_PERDA, formatQuantidade, isCausaPerda, lerQuantidade } from '@/lib/lotes-rotulos';
import { listLotesAbertos } from '@/lib/lotes';
import { can } from '@/lib/permissions';
import { nomeDia, rotuloSemana } from '@/lib/semanas';
import { turnoLabel } from '@/lib/turnos';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { ConfirmarForm } from '../ConfirmarForm';
import { ExcluirAtribuicaoForm } from '../ExcluirAtribuicaoForm';

interface AtribuicaoPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string; perda?: string; causa?: string }>;
}

/** T5.5, UC-20: a tarefa, quem fez e quanto, e a confirmação. */
export default async function AtribuicaoPage({ params, searchParams }: AtribuicaoPageProps) {
  const user = await requirePageAccess('agenda');
  const [{ id }, { feito, perda, causa }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const a = await findAtribuicao(pool, id);
  if (!a) notFound();

  const editavel = a.situacao === 'planejada' && a.semanaSituacao !== 'fechada';
  const podeConfirmar = editavel && a.participantes.length > 0 && can(user.perfil, 'confirmacao_tarefa', 'C');
  const podeAlterar = editavel && can(user.perfil, 'agenda', 'A');
  const podeExcluir = editavel && can(user.perfil, 'agenda', 'E');
  const [lotes, areas] = await Promise.all([
    podeConfirmar && a.exigeLote ? listLotesAbertos(pool) : [],
    podeConfirmar && a.exigeArea && !a.exigeLote ? listAreas(pool) : [],
  ]);
  const perdaRegistrada = lerQuantidade(perda ?? '');
  const hora = formatHoraTarefa(a.horaInicio, a.horaFim);
  const feita = a.situacao === 'confirmada' || a.situacao === 'nao_confirmada';

  return (
    <main>
      <PageHeader area="2 · Produção" title={a.tipo} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href={`/producao?dia=${a.data}`} className="text-base font-semibold text-brand-dark">
          Voltar à agenda do dia
        </Link>
        {feito === 'confirmada' && (
          <Notice tone="success">
            Tarefa confirmada.
            {perdaRegistrada !== null && causa && isCausaPerda(causa) &&
              ` Perda de ${formatQuantidade(perdaRegistrada)} por ${CAUSAS_PERDA[causa].toLowerCase()} registrada no lote.`}
          </Notice>
        )}
        {feito === 'alterada' && <Notice tone="success">Tarefa alterada.</Notice>}
        {a.situacao === 'nao_confirmada' && (
          <Notice tone="warning">
            Ninguém confirmou esta tarefa até o fechamento da semana. Ela conta como realizada, com essa marca.
          </Notice>
        )}
        {a.semanaSituacao === 'fechada' && a.situacao === 'planejada' && (
          <Notice tone="info">A semana fechou com esta tarefa sem ninguém escalado. Ela segue pendente.</Notice>
        )}

        <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-ink">
              {nomeDia(a.data)}, {formatData(a.data)}
            </h2>
            <Pill tone={TOM_ESTADO[estadoTarefa(a)]}>{ESTADOS_TAREFA[estadoTarefa(a)]}</Pill>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-base">
            <div>
              <dt className="text-sm text-muted">Turno</dt>
              <dd className="font-semibold text-ink">{turnoLabel(a.turno)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Hora</dt>
              <dd className="font-semibold text-ink">{hora ?? 'sem hora marcada'}</dd>
            </div>
            {a.loteId && (
              <div>
                <dt className="text-sm text-muted">Lote</dt>
                <dd>
                  <Link href={`/producao/lotes/${a.loteId}`} className="font-semibold text-brand-dark underline">
                    {a.loteCodigo}
                  </Link>
                </dd>
              </div>
            )}
            {a.especie && (
              <div>
                <dt className="text-sm text-muted">Espécie</dt>
                <dd className="font-semibold text-ink">{a.especie}</dd>
              </div>
            )}
            {a.recipiente && (
              <div>
                <dt className="text-sm text-muted">Recipiente</dt>
                <dd className="font-semibold text-ink">{a.recipiente}</dd>
              </div>
            )}
            {(a.canteiro || a.area) && (
              <div>
                <dt className="text-sm text-muted">{a.canteiro ? 'Canteiro' : 'Área'}</dt>
                <dd className="font-semibold text-ink">{a.canteiro ?? a.area}</dd>
              </div>
            )}
            {a.quantidadePlanejada !== null && (
              <div>
                <dt className="text-sm text-muted">Prevista</dt>
                <dd className="font-semibold text-ink">{formatQuantidadeMedida(a.quantidadePlanejada, a.unidadeMedida)}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted">Semana</dt>
              <dd>
                <Link href={`/producao/agenda?semana=${a.semanaInicio}`} className="font-semibold text-brand-dark underline">
                  {rotuloSemana(a.semanaInicio)}
                </Link>
              </dd>
            </div>
          </dl>
          {a.eRecorrente && <p className="text-sm text-muted">Repete toda semana: vem junto quando a semana seguinte é aberta.</p>}
          {a.observacoes && <p className="text-base text-muted">{a.observacoes}</p>}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Quem</h2>
          {a.participantes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-3 text-base text-muted">Ninguém escalado.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
              {a.participantes.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-base">
                  <span className="font-semibold text-ink">{p.nome}</span>
                  {feita && a.eQuantitativa && (
                    <span className={p.quantidade === null ? 'text-muted' : 'font-bold text-ink'}>
                      {p.quantidade === null ? 'sem contagem' : formatQuantidadeMedida(p.quantidade, a.unidadeMedida)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {editavel && a.participantes.length === 0 && podeAlterar && (
          <Notice tone="info">Escale ao menos uma pessoa antes de confirmar.</Notice>
        )}

        {podeConfirmar && (
          <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
            <h2 className="text-lg font-bold text-ink">Confirmar que foi feita</h2>
            <ConfirmarForm
              atribuicaoId={a.id}
              exigeLote={a.exigeLote}
              exigeArea={a.exigeArea}
              eQuantitativa={a.eQuantitativa}
              unidadeMedida={a.unidadeMedida}
              participantes={a.participantes}
              lotes={lotes.map((l) => ({ value: l.id, label: `${l.codigo} · ${l.especie} · ${l.recipiente}` }))}
              areas={areas.map((area) => ({ id: area.id, letra: area.letra, canteiros: area.canteiros }))}
              loteId={a.loteId}
              areaId={a.areaId}
              canteiroId={a.canteiroId}
            />
          </section>
        )}

        {podeAlterar && (
          <Link
            href={`/producao/agenda/${a.id}/editar`}
            className="inline-flex min-h-touch items-center justify-center rounded-xl border-2 border-brand bg-white px-5 text-base font-bold text-brand active:bg-brand-light"
          >
            Alterar tarefa
          </Link>
        )}
        {podeExcluir && <ExcluirAtribuicaoForm atribuicaoId={a.id} />}
      </div>
    </main>
  );
}
