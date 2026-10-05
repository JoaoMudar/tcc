'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ResultadoBusca, ResultadoFlora } from '@/lib/especies-ffb';

const ESPERA_MS = 250;
const MIN_BUSCA = 3;

export interface EscolhaFlora {
  taxonId: string;
  nomeCientifico: string;
  nomePopular: string | null;
  familia: string | null;
  /** O nome antigo que a pessoa tocou, quando foi esse */
  nomeAntigo: { taxonId: string; nomeCientifico: string } | null;
}

interface BuscaNomeEspecieProps {
  buscar: (termo: string) => Promise<ResultadoBusca>;
  onEscolher: (escolha: EscolhaFlora) => void;
}

/** O nome antigo leva ao de hoje: é o de hoje que entra no cadastro. */
export function paraEscolha(r: ResultadoFlora): EscolhaFlora {
  return r.aceito
    ? {
        taxonId: r.aceito.taxonId,
        nomeCientifico: r.aceito.nomeCientifico,
        nomePopular: r.nomePopular,
        familia: r.familia,
        nomeAntigo: { taxonId: r.taxonId, nomeCientifico: r.nomeCientifico },
      }
    : { taxonId: r.taxonId, nomeCientifico: r.nomeCientifico, nomePopular: r.nomePopular, familia: r.familia, nomeAntigo: null };
}

/**
 * RF-68: um campo só. A pessoa digita o nome que conhece, popular ou
 * científico, e vê primeiro o que o viveiro já tem (tocar abre a espécie, em
 * vez de cadastrar outra igual) e depois as plantas da Flora do Brasil.
 */
export function BuscaNomeEspecie({ buscar, onEscolher }: BuscaNomeEspecieProps) {
  const router = useRouter();
  const [termo, setTermo] = useState('');
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [buscando, setBuscando] = useState(false);
  const ultima = useRef(0);

  useEffect(() => {
    if (termo.trim().length < MIN_BUSCA) return;
    const pedido = ++ultima.current;
    const espera = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscar(termo);
        // Resposta atrasada de uma digitação anterior não sobrescreve a atual
        if (pedido === ultima.current) setResultado(r);
      } catch {
        if (pedido === ultima.current) setResultado(null);
      } finally {
        if (pedido === ultima.current) setBuscando(false);
      }
    }, ESPERA_MS);
    return () => clearTimeout(espera);
  }, [termo, buscar]);

  const curto = termo.trim().length < MIN_BUSCA;
  const nada = !curto && !buscando && resultado && resultado.doViveiro.length === 0 && resultado.daFlora.length === 0;

  return (
    <section className="flex flex-col gap-2" aria-label="Procurar a planta">
      <label htmlFor="busca-especie" className="text-sm font-semibold text-gray-700">
        Procurar a planta
      </label>
      <input
        id="busca-especie"
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.currentTarget.value)}
        placeholder="Nome popular ou científico"
        autoComplete="off"
        className="min-h-touch w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink placeholder:text-gray-400 focus:border-brand-dark focus:outline-none"
      />
      {buscando && <p className="text-sm text-muted">Procurando…</p>}
      {nada && <p className="text-sm text-muted">Nada encontrado. Preencha o nome abaixo.</p>}

      {!curto && resultado && resultado.doViveiro.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-gray-700">Já produzimos</h3>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
            {resultado.doViveiro.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/cadastros/especies/${r.id}`)}
                  className="flex min-h-touch w-full flex-col items-start px-4 py-2 text-left active:bg-brand-light"
                >
                  <span className="text-base font-semibold text-ink">{r.nome}</span>
                  <span className="text-sm text-muted italic">{r.nomeCientifico}</span>
                  {r.achadaPor && <span className="text-sm text-muted">também chamada de {r.achadaPor}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!curto && resultado && resultado.daFlora.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-gray-700">Outras espécies (Flora do Brasil)</h3>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-white">
            {resultado.daFlora.map((r) => (
              <li key={r.taxonId}>
                <button
                  type="button"
                  onClick={() => {
                    onEscolher(paraEscolha(r));
                    setTermo('');
                    setResultado(null);
                  }}
                  className="flex min-h-touch w-full flex-col items-start px-4 py-2 text-left active:bg-brand-light"
                >
                  <span className="text-base font-semibold text-ink">{r.nomePopular ?? r.aceito?.nomeCientifico ?? r.nomeCientifico}</span>
                  <span className="text-sm text-muted italic">{r.aceito?.nomeCientifico ?? r.nomeCientifico}</span>
                  {r.aceito && <span className="text-sm text-muted">antes chamada de <i>{r.nomeCientifico}</i></span>}
                  <span className="text-sm text-muted">
                    {[r.familia, r.nativaSc ? 'nativa de SC' : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
