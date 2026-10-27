import Link from 'next/link';
import { Pill } from '@/components/ui/Pill';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { type AreaNoMapa, type LoteNoMapa, type SituacaoLote, SITUACOES_LOTE, TOM_SITUACAO, textoPendencia } from '@/lib/mapa';
import { formatPercentual } from '@/lib/perdas';

/** A cor do quadradinho, e ela mede uma coisa só: tarefa que não foi feita. */
export const FUNDO: Record<SituacaoLote, string> = {
  saudavel: 'bg-green-200',
  atencao: 'bg-amber-200',
  critico: 'bg-red-300',
};

/** RF-36: a taxa vai no texto de todo lote, e o "acima do limite" só no destacado. */
function textoMortalidade(lote: LoteNoMapa, destacado: boolean, limite: number): string | null {
  if (lote.taxa === null) return null;
  const taxa = `mortalidade ${formatPercentual(lote.taxa)}`;
  return destacado ? `${taxa}, acima do limite de ${limite}%` : taxa;
}

/**
 * O lote no desenho. Apontá-lo diz qual tarefa falta e há quantos dias (T7.2):
 * a cor sozinha diz que algo está errado, e o que se quer é a providência. O
 * mesmo texto vai no `title`, para o ponteiro, e no `aria-label`, para quem lê
 * por leitor de tela.
 *
 * **RF-36: o lote acima do limite mostra o percentual escrito no quadrado**, e
 * não só no ponteiro: o critério pede o percentual visível, e tooltip não é.
 */
export function Quadrado({
  lote,
  hoje,
  destacado,
  limite,
}: {
  lote: LoteNoMapa;
  hoje: string;
  destacado: boolean;
  limite: number;
}) {
  const pendencia = textoPendencia(lote, hoje);
  const descricao = [
    `${lote.codigo} · ${lote.especie} · ${formatQuantidade(lote.saldo)} mudas`,
    pendencia ?? SITUACOES_LOTE[lote.situacao],
    textoMortalidade(lote, destacado, limite),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/producao/lotes/${lote.id}`}
      title={descricao}
      aria-label={descricao}
      className={`flex h-7 min-w-7 items-center justify-center rounded-sm px-0.5 text-[11px] leading-none font-bold text-ink ${FUNDO[lote.situacao]} ${
        // O contorno escuro é a mortalidade, e não a cor: as duas medem coisas diferentes
        destacado ? 'border-2 border-ink' : 'border border-black/10'
      }`}
    >
      {destacado && lote.taxa !== null ? formatPercentual(lote.taxa) : null}
    </Link>
  );
}

/**
 * RNF-03: no celular o desenho vira lista recolhível, área, canteiro e lote, com
 * a mesma informação do computador: a situação de cada lote, a pendência e a
 * mortalidade. Perde-se só a disposição lado a lado das áreas.
 */
export function MapaCelular({
  mapa,
  hoje,
  destacados,
  limite,
}: {
  mapa: readonly AreaNoMapa[];
  hoje: string;
  destacados: ReadonlySet<string>;
  limite: number;
}) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {mapa.map((area) => (
        <li key={area.id}>
          <details className="rounded-xl border border-line bg-white">
            <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="flex flex-col">
                <span className="text-base font-semibold text-ink">Área {area.letra}</span>
                <span className="text-sm text-muted">
                  {area.ocupados} de {area.canteiros.length} canteiros ocupados
                </span>
              </span>
              <span className="flex gap-1">
                {(Object.keys(SITUACOES_LOTE) as SituacaoLote[])
                  .filter((situacao) => area.contagem[situacao] > 0)
                  .map((situacao) => (
                    <Pill key={situacao} tone={TOM_SITUACAO[situacao]}>
                      {area.contagem[situacao]}
                    </Pill>
                  ))}
              </span>
            </summary>
            <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
              {area.canteiros.length === 0 && <p className="text-sm text-muted">Nenhum canteiro cadastrado.</p>}
              {area.canteiros.map((canteiro) => (
                <div key={canteiro.id} className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-muted">
                    Canteiro {area.letra}-{canteiro.numero}
                    {canteiro.livre && <span className="font-normal italic"> · livre</span>}
                  </p>
                  {canteiro.lotes.map((lote) => {
                    const destacado = destacados.has(lote.id);
                    const pendencia = textoPendencia(lote, hoje);
                    return (
                      <Link
                        key={lote.id}
                        href={`/producao/lotes/${lote.id}`}
                        className="flex min-h-touch flex-col justify-center gap-0.5 rounded-lg border border-line px-3 py-2"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-base font-semibold text-ink">
                            {lote.codigo} · {lote.especie}
                          </span>
                          <Pill tone={TOM_SITUACAO[lote.situacao]}>{SITUACOES_LOTE[lote.situacao]}</Pill>
                        </span>
                        <span className="text-sm text-muted">
                          {formatQuantidade(lote.saldo)} mudas
                          {lote.taxa !== null && (
                            <span className={destacado ? 'font-bold text-red-800' : undefined}>
                              {' '}
                              · mortalidade {formatPercentual(lote.taxa)}
                              {destacado && `, acima de ${limite}%`}
                            </span>
                          )}
                        </span>
                        {pendencia && <span className="text-sm text-ink">{pendencia}</span>}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
