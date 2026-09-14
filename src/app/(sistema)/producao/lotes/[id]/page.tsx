import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import { formatData } from '@/lib/datas';
import pool from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { CAUSAS_PERDA, FASES, TIPOS_MOVIMENTO, formatQuantidade } from '@/lib/lotes-rotulos';
import { findLote, listCanteirosParaLote, listMovimentos } from '@/lib/lotes';
import { acimaDoLimite, formatPercentual, limiteMortalidade, mortalidade } from '@/lib/perdas';
import { can } from '@/lib/permissions';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { AcaoRecolhivel } from './AcaoRecolhivel';
import { ContagemForm } from './ContagemForm';
import { FaseForm } from './FaseForm';
import { PerdaForm } from './PerdaForm';
import { RepicagemForm } from './RepicagemForm';
import { TransferenciaForm } from './TransferenciaForm';

interface LotePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feito?: string }>;
}

/** T4.4, RF-35: a ficha do lote, o histórico que explica o saldo e as ações da gerência. */
export default async function LotePage({ params, searchParams }: LotePageProps) {
  const user = await requirePageAccess('lotes');
  const [{ id }, { feito }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const lote = await findLote(pool, id);
  if (!lote) notFound();

  const aberto = lote.encerradoEm === null;
  const podePerda = aberto && can(user.perfil, 'perdas', 'C');
  const podeMovimento = aberto && can(user.perfil, 'movimentos_lote', 'C');
  const podeRepicar = podeMovimento && can(user.perfil, 'lotes', 'C');
  const podeFase = aberto && can(user.perfil, 'lotes', 'A');

  const [movimentos, limite, canteiros, recipientes] = await Promise.all([
    listMovimentos(pool, id),
    limiteMortalidade(pool),
    podeMovimento ? listCanteirosParaLote(pool) : [],
    podeRepicar ? listRecipientes(pool) : [],
  ]);
  const taxa = mortalidade(lote.perdas, lote.quantidadeInicial);
  const alerta = acimaDoLimite(taxa, limite);
  const destinos = recipientes
    .filter((r) => r.ativo && r.id !== lote.recipienteId)
    .map((r) => ({ value: r.id, label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}` }));

  return (
    <main>
      <PageHeader area="2 · Produção" title={`Lote ${lote.codigo}`} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/producao/lotes" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {feito === 'criado' && <Notice tone="success">Lote {lote.codigo} criado.</Notice>}
        {feito === 'repicado' && (
          <Notice tone="success">
            Repicagem registrada. Este é o lote novo, ligado ao {lote.origemCodigo}.
          </Notice>
        )}
        {!aberto && (
          <Notice tone="info">
            Lote encerrado em {formatDateTime(lote.encerradoEm!)}: saiu do canteiro e não recebe movimento. O histórico continua aqui.
          </Notice>
        )}

        <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
          <div>
            <h2 className="text-xl font-bold text-ink">{lote.especie}</h2>
            {lote.especie !== lote.nomeCientifico && <p className="text-sm text-muted italic">{lote.nomeCientifico}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-base">
            <div>
              <dt className="text-sm text-muted">Saldo</dt>
              <dd className="text-2xl font-bold text-ink">{formatQuantidade(lote.quantidadeAtual)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Fase</dt>
              <dd className="mt-1">
                <Pill tone={lote.fase === 'pronto' ? 'green' : 'neutral'}>{FASES[lote.fase]}</Pill>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Recipiente</dt>
              <dd className="font-semibold text-ink">{lote.recipiente}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Canteiro</dt>
              <dd className="font-semibold text-ink">{lote.canteiro ?? 'nenhum'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Plantio</dt>
              <dd className="font-semibold text-ink">{formatData(lote.dataPlantio)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Quantidade inicial</dt>
              <dd className="font-semibold text-ink">{formatQuantidade(lote.quantidadeInicial)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-sm text-muted">Mortalidade</dt>
              <dd className={`font-semibold ${alerta ? 'text-red-800' : 'text-ink'}`}>
                {taxa === null ? '-' : formatPercentual(taxa)} · {formatQuantidade(lote.perdas)} perdidas
                {alerta && <span className="block text-sm">Acima do limite de {limite}% definido em Configurações.</span>}
              </dd>
            </div>
          </dl>
          {lote.origemId && (
            <p className="text-base">
              <span className="text-muted">Veio do lote </span>
              <Link href={`/producao/lotes/${lote.origemId}`} className="font-semibold text-brand-dark underline">
                {lote.origemCodigo}
              </Link>
            </p>
          )}
          {lote.filhos.length > 0 && (
            <p className="text-base">
              <span className="text-muted">Deu origem a </span>
              {lote.filhos.map((filho, i) => (
                <span key={filho.id}>
                  {i > 0 && ', '}
                  <Link href={`/producao/lotes/${filho.id}`} className="font-semibold text-brand-dark underline">
                    {filho.codigo}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {lote.observacoes && <p className="text-base text-muted">{lote.observacoes}</p>}
        </section>

        {podePerda && (
          <AcaoRecolhivel titulo="Registrar perda">
            <PerdaForm loteId={lote.id} saldo={lote.quantidadeAtual} />
          </AcaoRecolhivel>
        )}
        {podeMovimento && (
          <AcaoRecolhivel titulo="Contagem física">
            <ContagemForm loteId={lote.id} saldo={lote.quantidadeAtual} />
          </AcaoRecolhivel>
        )}
        {podeRepicar && (
          <AcaoRecolhivel titulo="Repicar">
            {destinos.length === 0 ? (
              <Notice tone="info">Não há outro recipiente em uso para repicar.</Notice>
            ) : (
              <RepicagemForm
                loteId={lote.id}
                codigo={lote.codigo}
                saldo={lote.quantidadeAtual}
                recipientes={destinos}
                canteiros={canteiros}
              />
            )}
          </AcaoRecolhivel>
        )}
        {podeMovimento && lote.canteiroId && (
          <AcaoRecolhivel titulo="Transferir de canteiro">
            <TransferenciaForm loteId={lote.id} saldo={lote.quantidadeAtual} canteiroAtualId={lote.canteiroId} canteiros={canteiros} />
          </AcaoRecolhivel>
        )}
        {podeFase && (
          <AcaoRecolhivel titulo="Alterar fase">
            <FaseForm loteId={lote.id} fase={lote.fase} />
          </AcaoRecolhivel>
        )}

        <h2 className="mt-4 text-sm font-bold tracking-widest text-muted uppercase">Histórico</h2>
        <ol className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
          {movimentos.map((movimento) => (
            <li key={movimento.id} className="flex flex-col gap-0.5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-base font-semibold text-ink">
                  {TIPOS_MOVIMENTO[movimento.tipo]}
                  {movimento.causa && <span className="font-normal text-muted"> · {CAUSAS_PERDA[movimento.causa].toLowerCase()}</span>}
                </span>
                <span className={`text-base font-bold ${movimento.quantidade < 0 ? 'text-red-800' : 'text-green-800'}`}>
                  {movimento.quantidade > 0 ? '+' : ''}
                  {movimento.tipo === 'transferencia'
                    ? `${movimento.canteiroOrigem} → ${movimento.canteiroDestino}`
                    : formatQuantidade(movimento.quantidade)}
                </span>
              </div>
              <span className="text-sm text-muted">
                {formatData(movimento.data)} · {movimento.registradoPor}
              </span>
              {movimento.observacoes && <span className="text-sm text-muted">{movimento.observacoes}</span>}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">
          A soma do histórico dá o saldo: {formatQuantidade(lote.quantidadeAtual)}.
        </p>
      </div>
    </main>
  );
}
