'use client';

import { type ClipboardEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { chaveSaldo, normalizaCampoAltura } from '@/lib/pedidos-rotulos';
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
  /** O nome digitado que não está no catálogo, para cadastrar e voltar escolhido na linha. */
  onCriarEspecie: (chave: number, nome: string) => void;
}

const rotuloCriarEspecie = (nome: string) => `+ Cadastrar "${nome}" como espécie nova`;

function IconeLixeira() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
 * **A planilha só aparece de `lg` para cima**: com o menu lateral, a tela `md`
 * deixa menos de 500px para cinco colunas, e a espécie sumia espremida.
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
  onCriarEspecie,
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

  /** O genérico é a primeira opção da espécie: a escolha fica para a conferência. */
  const opcaoGenerico = (chave: number) => ({
    rotulo: 'Genérico',
    onEscolher: () => onAlterar(chave, 'generico', true),
  });

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
          <input type="hidden" name="item_especificacao" value={linha.generico ? linha.especificacao : ''} />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Itens</h2>
        <Button variant="outline" className="h-9 min-h-0! w-auto! shrink-0 px-3! text-sm!" onClick={onColarLista}>
          📋 Colar lista
        </Button>
      </div>

      {/* Planilha: tela larga. Sem `overflow-hidden` no contorno, porque a lista
          de opções da célula precisa passar por cima da borda de baixo */}
      <div className="hidden rounded-xl border border-line bg-white lg:block" onPaste={aoColar}>
        <table className="w-full table-fixed border-collapse text-base">
          <colgroup>
            <col />
            <col className="w-48" />
            <col className="w-28" />
            <col className="w-32" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="bg-surface text-left text-xs font-bold tracking-wide text-muted uppercase">
              <th scope="col" className="rounded-tl-xl px-3 py-2">
                Espécie
              </th>
              <th scope="col" className="border-l border-line px-3 py-2">
                Recipiente
              </th>
              <th scope="col" className="border-l border-line px-3 py-2">
                Altura
              </th>
              <th scope="col" className="border-l border-line px-3 py-2 text-right">
                Quantidade
              </th>
              <th scope="col" className="rounded-tr-xl border-l border-line">
                <span className="sr-only">Excluir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, indice) => {
              const { saldo, pronto, quantidade, falta } = saldoDa(linha);
              return (
                <tr key={linha.chave} className="border-t border-line align-top">
                  {/* O foco marca em que célula a colagem começa, e o `onFocus`
                      da célula vale para o campo de dentro, qualquer que ele seja */}
                  <td className="p-0" onFocus={() => setFoco({ linha: indice, coluna: 0 })}>
                    {linha.generico ? (
                      <>
                        {/* O genérico se descreve: é o texto que a gerência lê para montar o item */}
                        <TextField
                          label={`O que o cliente pediu no item ${indice + 1}`}
                          compacto
                          autoComplete="off"
                          placeholder="Ex.: mudas nativas, o que tiver"
                          value={linha.especificacao}
                          onChange={(evento) => onAlterar(linha.chave, 'especificacao', evento.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => onAlterar(linha.chave, 'generico', false)}
                          className="px-3 pb-1.5 text-left text-xs font-semibold text-blue-900 underline"
                        >
                          Escolher a espécie
                        </button>
                      </>
                    ) : (
                      <ComboboxField
                        label={`Espécie do item ${indice + 1}`}
                        compacto
                        options={opcoesEspecie}
                        value={linha.especieId}
                        onChange={(valor) => onAlterar(linha.chave, 'especieId', valor)}
                        onCriarNova={(nome) => onCriarEspecie(linha.chave, nome)}
                        rotuloCriar={rotuloCriarEspecie}
                        opcaoFixa={opcaoGenerico(linha.chave)}
                        placeholder="Digite o nome…"
                      />
                    )}
                    {/* RF-56: o saldo não é coluna, é a linha miúda embaixo da espécie */}
                    {linha.especieId && linha.recipienteId && (
                      <p className={`px-3 pb-1.5 text-xs ${falta ? 'font-semibold text-amber-800' : 'text-muted'}`}>
                        Pronto: {formatQuantidade(pronto)}
                        {saldo && saldo.producao > 0 && ` · ${formatQuantidade(saldo.producao)} em produção`}
                        {falta && quantidade !== null && ` · faltam ${formatQuantidade(quantidade - pronto)}`}
                      </p>
                    )}
                  </td>
                  <td className="border-l border-line p-0" onFocus={() => setFoco({ linha: indice, coluna: 1 })}>
                    <ComboboxField
                      label={`Recipiente do item ${indice + 1}`}
                      compacto
                      options={recipientes}
                      value={linha.recipienteId}
                      onChange={(valor) => onAlterar(linha.chave, 'recipienteId', valor)}
                      placeholder="a definir"
                    />
                  </td>
                  <td className="border-l border-line p-0">
                    <TextField
                      label={`Altura do item ${indice + 1}, em metros`}
                      compacto
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="opcional"
                      value={linha.altura}
                      onFocus={() => setFoco({ linha: indice, coluna: 2 })}
                      onChange={(evento) => onAlterar(linha.chave, 'altura', evento.target.value)}
                      onBlur={(evento) => onAlterar(linha.chave, 'altura', normalizaCampoAltura(evento.target.value))}
                    />
                  </td>
                  <td className="border-l border-line p-0">
                    <TextField
                      label={`Quantidade do item ${indice + 1}`}
                      compacto
                      className="[&_input]:text-right"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="opcional"
                      value={linha.quantidade}
                      onFocus={() => setFoco({ linha: indice, coluna: 3 })}
                      onChange={(evento) => onAlterar(linha.chave, 'quantidade', evento.target.value)}
                    />
                  </td>
                  <td className="border-l border-line p-0">
                    <button
                      type="button"
                      onClick={() => onRemover(linha.chave)}
                      aria-label={`Excluir o item ${indice + 1}`}
                      title="Excluir linha"
                      className="flex h-11 w-full items-center justify-center text-muted hover:bg-red-50 hover:text-red-700"
                    >
                      <IconeLixeira />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => onAdicionar(false)}
          className="h-11 w-full rounded-b-xl border-t border-line px-3 text-left text-base font-bold text-brand hover:bg-brand-light"
        >
          + Adicionar linha
        </button>
      </div>

      {/* Lista: celular */}
      <div className="overflow-hidden rounded-xl border border-line bg-white lg:hidden">
        <ul className="flex flex-col divide-y divide-line">
          {linhas.map((linha, indice) => {
            const { falta, quantidade } = saldoDa(linha);
            const opcaoEspecie = linha.generico ? undefined : opcoesEspecie.find((opcao) => opcao.value === linha.especieId);
            const especie = linha.generico
              ? `Sem espécie: ${linha.especificacao.trim() || 'descreva o pedido'}`
              : (opcaoEspecie?.label ?? null);
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
                    {opcaoEspecie?.detalhe && <span className="text-xs text-muted italic">{opcaoEspecie.detalhe}</span>}
                    <span className="text-sm text-muted">
                      {[recipiente, linha.altura && normalizaCampoAltura(linha.altura)].filter(Boolean).join(' · ') ||
                        'Toque para preencher'}
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
