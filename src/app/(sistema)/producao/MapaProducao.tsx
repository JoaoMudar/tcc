import Link from 'next/link';
import { Pill } from '@/components/ui/Pill';
import { listAreas } from '@/lib/areas';
import { hojeNoViveiro } from '@/lib/datas';
import pool from '@/lib/db';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import {
  type SituacaoLote,
  SITUACOES_LOTE,
  TOM_SITUACAO,
  contarSituacoes,
  listLotesDoMapa,
  montarMapa,
  pedemProvidencia,
  textoPendencia,
} from '@/lib/mapa';
import { acimaDoLimite, formatPercentual, limiteMortalidade } from '@/lib/perdas';
import { MapaCelular, Quadrado } from './MapaLotes';

const TEXTO: Record<SituacaoLote, string> = {
  saudavel: 'text-green-800',
  atencao: 'text-amber-800',
  critico: 'text-red-800',
};

/**
 * T7.1 a T7.3, RF-33, RF-52, RF-36, UC-27: o viveiro desenhado como ele é. A
 * área é o quadro, o canteiro é a faixa dentro dela e o lote é o quadrado dentro
 * do canteiro, porque um canteiro comporta várias levas.
 *
 * **É tela de computador (RNF-03)**, e é exceção declarada: o mapa existe para
 * mostrar o viveiro inteiro de uma vez, e trinta canteiros lado a lado não cabem
 * na largura de um celular. Espremer não encolhe o mapa, desfaz a comparação
 * entre áreas, que é o que se veio ver. **No celular ele vira lista recolhível**
 * (área, canteiro e lote), com a situação, a pendência e a mortalidade de cada
 * lote: perde-se a disposição lado a lado, e não a informação (RNF-03).
 */
export async function MapaProducao() {
  const [areas, lotes, limite] = await Promise.all([listAreas(pool), listLotesDoMapa(pool), limiteMortalidade(pool)]);
  const hoje = hojeNoViveiro();
  const mapa = montarMapa(areas, lotes);
  const contagem = contarSituacoes(lotes);
  const providencia = pedemProvidencia(lotes);
  // RF-36: a mortalidade tem destaque próprio, e de propósito não entra na cor
  const destacados = new Set(lotes.filter((lote) => acimaDoLimite(lote.taxa, limite)).map((lote) => lote.id));
  const canteiros = mapa.reduce((soma, area) => soma + area.canteiros.length, 0);

  if (areas.length === 0) {
    return (
      <p className="text-base text-muted">
        Nenhuma área cadastrada.{' '}
        <Link href="/cadastros/areas" className="font-semibold text-brand-dark underline">
          Cadastrar áreas e canteiros
        </Link>
      </p>
    );
  }

  return (
    <>
      {/* O desenho, só no computador: é ele que não cabe no celular (RNF-03) */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
        {mapa.map((area) => (
          <section key={area.id} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">
                Área {area.letra}
                {area.nome && <span className="font-normal text-muted"> · {area.nome}</span>}
              </h2>
              <span className="text-sm text-muted">
                {area.ocupados} de {area.canteiros.length} ocupados
              </span>
            </div>
            {area.canteiros.length === 0 && <p className="text-base text-muted">Nenhum canteiro cadastrado.</p>}
            {area.canteiros.map((canteiro) => (
              <div key={canteiro.id} className="flex items-start gap-2">
                <span className="w-12 shrink-0 py-1 text-sm font-semibold text-muted">
                  {area.letra}-{canteiro.numero}
                </span>
                {canteiro.livre ? (
                  <span className="py-1 text-sm text-muted italic">livre</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {canteiro.lotes.map((lote) => (
                      <Quadrado key={lote.id} lote={lote} hoje={hoje} destacado={destacados.has(lote.id)} limite={limite} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>

      <p className="hidden text-sm text-muted md:block">
        Cada quadradinho é um lote, e a faixa é o canteiro. O contorno escuro e o número escrito marcam mortalidade acima de{' '}
        {limite}%.
      </p>

      {/* No celular o desenho vira lista recolhível, com a mesma informação (RNF-03) */}
      <MapaCelular mapa={mapa} hoje={hoje} destacados={destacados} limite={limite} />

      {/* Os contadores ficam abaixo do desenho: quem abre o mapa vem ver o viveiro, e o resumo confere depois */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(SITUACOES_LOTE) as SituacaoLote[]).map((situacao) => (
            <div key={situacao} className="rounded-xl border border-line bg-white p-4">
              <p className="text-sm text-muted">{SITUACOES_LOTE[situacao]}</p>
              <p className={`text-2xl font-bold ${TEXTO[situacao]}`}>{contagem[situacao]}</p>
            </div>
          ))}
          <div className="rounded-xl border border-line bg-white p-4">
            <p className="text-sm text-muted">Mortalidade acima de {limite}%</p>
            <p className={`text-2xl font-bold ${destacados.size > 0 ? 'text-red-800' : 'text-ink'}`}>{destacados.size}</p>
          </div>
        </div>
        <p className="text-sm text-muted">
          {lotes.length} {lotes.length === 1 ? 'lote aberto' : 'lotes abertos'} em {canteiros}{' '}
          {canteiros === 1 ? 'canteiro' : 'canteiros'}. A cor não é digitada por ninguém: sai das tarefas e das etapas do
          protocolo vencidas ou a vencer em cada lote.
        </p>
      </div>

      <h2 className="mt-2 text-sm font-bold tracking-widest text-muted uppercase">Pedem providência</h2>
      {providencia.length === 0 ? (
        <p className="text-base text-muted">Nenhum lote com tarefa vencida ou a vencer.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {providencia.map((lote) => (
            <li key={lote.id}>
              <Link
                href={`/producao/lotes/${lote.id}`}
                className={`flex min-h-touch flex-col justify-center gap-0.5 rounded-xl border px-4 py-3 ${
                  lote.situacao === 'critico' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold text-ink">
                    {lote.codigo} · {lote.especie}
                  </span>
                  <Pill tone={TOM_SITUACAO[lote.situacao]}>{SITUACOES_LOTE[lote.situacao]}</Pill>
                </span>
                <span className={`text-sm font-semibold ${TEXTO[lote.situacao]}`}>{textoPendencia(lote, hoje)}</span>
                <span className="text-sm text-muted">
                  {formatQuantidade(lote.saldo)} mudas
                  {destacados.has(lote.id) && lote.taxa !== null && ` · mortalidade ${formatPercentual(lote.taxa)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

