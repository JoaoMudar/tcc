'use client';

import { ComboboxField } from '@/components/ui/ComboboxField';
import type { SelectOption } from '@/components/ui/SelectField';
import { IconeLixeira } from './IconeLixeira';
import type { LinhaGrupo } from './linhas-pedido';

interface GrupoEspeciesProps {
  /** "do item 3", para o rótulo de leitor de tela distinguir as linhas da planilha. */
  doItem: string;
  grupo: readonly LinhaGrupo[];
  opcoesEspecie: readonly SelectOption[];
  onAlterar: (grupo: LinhaGrupo[]) => void;
  /** Célula da planilha: campos sem rótulo visível e botões baixos. */
  compacto?: boolean;
}

/**
 * O grupo de espécies do item genérico: "100 mudas entre araçá, ipê-amarelo e
 * ingá-anão". Cada linha é uma espécie, com a lixeira ao lado. **Sem linha
 * nenhuma, qualquer espécie serve**, que é o genérico de sempre; com linhas, a
 * conferência só oferece estas, e o servidor recusa as de fora (T8.7).
 */
export function GrupoEspecies({ doItem, grupo, opcoesEspecie, onAlterar, compacto = false }: GrupoEspeciesProps) {
  const escolhidas = new Set(grupo.map((linha) => linha.especieId).filter(Boolean));

  const adicionar = () =>
    onAlterar([...grupo, { chave: Math.max(0, ...grupo.map((linha) => linha.chave)) + 1, especieId: '' }]);
  const trocar = (chave: number, especieId: string) =>
    onAlterar(grupo.map((linha) => (linha.chave === chave ? { ...linha, especieId } : linha)));
  const tirar = (chave: number) => onAlterar(grupo.filter((linha) => linha.chave !== chave));

  return (
    <div className={compacto ? 'flex flex-col border-t border-line' : 'flex flex-col gap-2'}>
      {!compacto && grupo.length > 0 && <p className="text-base font-semibold text-ink">Espécies que o cliente aceita</p>}
      {grupo.length > 0 && (
        <ul className={compacto ? 'flex flex-col' : 'flex flex-col gap-2'} aria-label={`Grupo de espécies ${doItem}`}>
          {grupo.map((linha, indice) => (
            <li key={linha.chave} className="flex items-end gap-1">
              <div className="min-w-0 flex-1">
                <ComboboxField
                  // Na planilha o rótulo é só de leitor de tela; na tela cheia ele aparece curto
                  label={compacto ? `Espécie ${indice + 1} do grupo ${doItem}` : `Espécie ${indice + 1}`}
                  compacto={compacto}
                  // A espécie já escolhida em outra linha sai da lista: repetida não muda o grupo
                  options={opcoesEspecie.filter(
                    (opcao) => opcao.value === linha.especieId || !escolhidas.has(opcao.value),
                  )}
                  value={linha.especieId}
                  onChange={(valor) => trocar(linha.chave, valor)}
                  placeholder="Digite o nome…"
                />
              </div>
              <button
                type="button"
                onClick={() => tirar(linha.chave)}
                aria-label={`Tirar a espécie ${indice + 1} do grupo ${doItem}`}
                title="Tirar do grupo"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700"
              >
                <IconeLixeira />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={adicionar}
        className={
          compacto
            ? 'h-9 px-3 text-left text-sm font-bold text-brand hover:bg-brand-light'
            : 'min-h-touch rounded-xl border border-dashed border-line px-4 text-left text-base font-bold text-brand active:bg-brand-light'
        }
      >
        + Adicionar espécie do grupo
      </button>
      {!compacto && grupo.length === 0 && (
        <p className="text-sm text-muted">Sem nenhuma, qualquer espécie serve.</p>
      )}
    </div>
  );
}
