'use client';

import { type ClipboardEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { chaveSaldo } from '@/lib/pedidos-rotulos';
import type { Celula, Linha } from './linhas-pedido';
import type { SaldosPorChave } from './NovoPedidoForm';

interface GradeItensProps {
  linhas: readonly Linha[];
  opcoesEspecie: readonly SelectOption[];
  recipientes: readonly SelectOption[];
  saldos: SaldosPorChave;
  onAlterar: (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string | boolean) => void;
  onRemover: (chave: number) => void;
  /** `true` abre a linha nova em tela cheia, que é o caminho do celular. */
  onAdicionar: (abrirFicha: boolean) => void;
  /** No celular a linha não se edita no lugar: ela abre em tela cheia. */
  onEditar: (chave: number) => void;
  onColar: (texto: string, foco: Celula | null) => void;
  onColarLista: () => void;
}

/** Os trilhos da planilha, repetidos no cabeçalho e em cada linha. */
const TRILHOS = 'grid grid-cols-[minmax(0,1fr)_11rem_6rem_7rem_3rem] items-start gap-x-2';

function rotulo(opcoes: readonly SelectOption[], valor: string): string | null {
  return opcoes.find((opcao) => opcao.value === valor)?.label ?? null;
}

/**
 * T8.1, RF-54: os itens do pedido como planilha na tela larga e como lista no
 * celular.
 *
 * **Os campos do formulário não são os que aparecem.** São os escondidos, um
 * bloco por linha, porque os dois desenhos convivem na mesma página e campos
 * com nome nos dois dobrariam as listas paralelas que o servidor lê.
 *
 * **No celular não se edita na lista** (RNF-03): cinco colunas em 360px seriam
 * alvos de toque menores que o dedo. A lista mostra o pedido, e tocar num item
 * abre a ficha dele em tela cheia, com um campo de cada vez.
 */
export function GradeItens({
  linhas,
  opcoesEspecie,
  recipientes,
  saldos,
  onAlterar,
  onRemover,
  onAdicionar,
  onEditar,
  onColar,
  onColarLista,
}: GradeItensProps) {
  const [foco, setFoco] = useState<Celula | null>(null);

  /**
   * Ctrl+V na planilha. O texto decide para onde vai, e a decisão é de quem
   * chamou: aqui só se descobre em que célula o cursor estava.
   */
  function aoColar(evento: ClipboardEvent<HTMLDivElement>) {
    const texto = evento.clipboardData.getData('text/plain');
    if (!texto) return;
    const varias = texto.includes('\t') || /\r?\n.*\S/.test(texto.trim());
    // Uma célula só é colagem comum, e o navegador faz melhor que nós
    if (!varias) return;
    evento.preventDefault();
    onColar(texto, foco);
  }

  function saldoDa(linha: Linha) {
    const saldo = saldos[chaveSaldo(linha.especieId, linha.recipienteId)];
    const pronto = saldo?.pronto ?? 0;
    const quantidade = lerQuantidade(linha.quantidade);
    const falta = Boolean(linha.especieId && linha.recipienteId && quantidade !== null && quantidade > pronto);
    return { saldo, pronto, quantidade, falta };
  }

  return (
    <>
      {/* As listas paralelas que o servidor lê, uma posição por linha da tela */}
      {linhas.map((linha) => (
        <div key={`campos-${linha.chave}`} hidden>
          <input type="hidden" name="item_generico" value={linha.generico ? '1' : '0'} />
          <input type="hidden" name="item_especie" value={linha.generico ? '' : linha.especieId} />
          <input type="hidden" name="item_recipiente" value={linha.recipienteId} />
          <input type="hidden" name="item_altura" value={linha.altura} />
          <input type="hidden" name="item_quantidade" value={linha.quantidade} />
          <input type="hidden" name="item_especificacao" value="" />
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Itens</h2>
        <Button variant="outline" className="w-auto" onClick={onColarLista}>
          📋 Colar lista
        </Button>
      </div>

      {/* Planilha: tela larga */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-white md:block" onPaste={aoColar}>
        <div className={`${TRILHOS} border-b border-line px-3 py-2 text-xs font-bold tracking-wide text-muted uppercase`}>
          <span>Espécie</span>
          <span>Recipiente</span>
          <span>Altura</span>
          <span>Quantidade</span>
          <span className="sr-only">Excluir</span>
        </div>

        <ul className="flex flex-col divide-y divide-line">
          {linhas.map((linha, indice) => {
            const { saldo, pronto, quantidade, falta } = saldoDa(linha);
            return (
              <li key={linha.chave} className="px-3 py-2">
                <div className={TRILHOS}>
                  {/* O foco marca em que célula a colagem começa, e o `onFocus`
                      do contêiner vale para o campo de dentro, qualquer que ele seja */}
                  <div className="min-w-0" onFocus={() => setFoco({ linha: indice, coluna: 0 })}>
                    {linha.generico ? (
                      <button
                        type="button"
                        onClick={() => onAlterar(linha.chave, 'generico', false)}
                        className="min-h-touch rounded-lg px-1 text-left text-base font-semibold text-blue-900 underline"
                      >
                        Espécie a definir na conferência
                      </button>
                    ) : (
                      <ComboboxField
                        label={`Espécie do item ${indice + 1}`}
                        compacto
                        options={opcoesEspecie}
                        value={linha.especieId}
                        onChange={(valor) => onAlterar(linha.chave, 'especieId', valor)}
                        placeholder="Procurar…"
                      />
                    )}
                  </div>
                  <div className="min-w-0" onFocus={() => setFoco({ linha: indice, coluna: 1 })}>
                    <ComboboxField
                      label={`Recipiente do item ${indice + 1}`}
                      compacto
                      options={recipientes}
                      value={linha.recipienteId}
                      onChange={(valor) => onAlterar(linha.chave, 'recipienteId', valor)}
                      placeholder="Procurar…"
                    />
                  </div>
                  <TextField
                    label={`Altura do item ${indice + 1}, em metros`}
                    compacto
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="1,20"
                    value={linha.altura}
                    onFocus={() => setFoco({ linha: indice, coluna: 2 })}
                    onChange={(evento) => onAlterar(linha.chave, 'altura', evento.target.value)}
                  />
                  <TextField
                    label={`Quantidade do item ${indice + 1}`}
                    compacto
                    inputMode="numeric"
                    autoComplete="off"
                    value={linha.quantidade}
                    onFocus={() => setFoco({ linha: indice, coluna: 3 })}
                    onChange={(evento) => onAlterar(linha.chave, 'quantidade', evento.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => onRemover(linha.chave)}
                    aria-label={`Excluir o item ${indice + 1}`}
                    className="min-h-touch rounded-lg text-xl text-muted active:bg-gray-100"
                  >
                    🗑
                  </button>
                </div>

                {/* RF-56: o saldo não é coluna, é o aviso que aparece quando falta muda */}
                {linha.especieId && linha.recipienteId && (
                  <p className={`mt-1 text-sm ${falta ? 'text-amber-800' : 'text-muted'}`}>
                    Pronto para venda: <strong>{formatQuantidade(pronto)}</strong>
                    {saldo && saldo.producao > 0 && ` · ${formatQuantidade(saldo.producao)} em produção, ainda não pronta`}
                    {falta && quantidade !== null && ` · faltam ${formatQuantidade(quantidade - pronto)}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => onAdicionar(false)}
          className="min-h-touch w-full border-t border-line px-3 text-left text-base font-bold text-brand active:bg-brand-light"
        >
          + Adicionar linha
        </button>
      </div>

      {/* Lista: celular */}
      <div className="overflow-hidden rounded-xl border border-line bg-white md:hidden">
        <ul className="flex flex-col divide-y divide-line">
          {linhas.map((linha, indice) => {
            const { falta, quantidade } = saldoDa(linha);
            const especie = linha.generico ? 'Espécie a definir na conferência' : rotulo(opcoesEspecie, linha.especieId);
            const recipiente = rotulo(recipientes, linha.recipienteId);
            return (
              <li key={linha.chave}>
                <button
                  type="button"
                  onClick={() => onEditar(linha.chave)}
                  className="grid min-h-touch w-full grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 text-left active:bg-brand-light"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-base font-semibold text-ink">{especie ?? `Item ${indice + 1}, sem espécie`}</span>
                    <span className="text-sm text-muted">
                      {[recipiente, linha.altura && `${linha.altura} m`].filter(Boolean).join(' · ') || 'Toque para preencher'}
                    </span>
                  </span>
                  <span className={`text-base font-semibold ${falta ? 'text-amber-800' : 'text-ink'}`}>
                    {quantidade === null ? '—' : formatQuantidade(quantidade)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => onAdicionar(true)}
          className="min-h-touch w-full border-t border-line px-4 text-left text-base font-bold text-brand active:bg-brand-light"
        >
          + Adicionar item
        </button>
      </div>
    </>
  );
}
