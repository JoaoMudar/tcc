'use client';

import { type ClipboardEvent, Fragment, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { MARCA_OBRIGATORIO } from '@/components/ui/marcaObrigatorio';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import {
  chaveSaldo,
  mascaraAltura,
  normalizaCampoAltura,
  parseAltura,
  rotuloGenerico,
  rotuloGrupo,
  saldoDoItem,
} from '@/lib/pedidos-rotulos';
import { GrupoEspecies } from './GrupoEspecies';
import { IconeLixeira } from './IconeLixeira';
import {
  BARRA_CONFERENCIA,
  type Celula,
  CLASSE_LINHA_PAI,
  type ConferenciaDaLinha,
  type Linha,
  type LinhaLeitura,
  type SaldosPorChave,
  type ValorLinha,
  especiesDoGrupo,
  faltaNoItem,
  textoSaldo,
} from './linhas-pedido';

interface GradeItensProps {
  linhas: readonly Linha[];
  opcoesEspecie: readonly SelectOption[];
  recipientes: readonly SelectOption[];
  saldos: SaldosPorChave;
  onAlterar: (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: ValorLinha) => void;
  onRemover: (chave: number) => void;
  /** `true` abre a linha nova em tela cheia, que é o caminho do celular. */
  onAdicionar: (abrirFicha: boolean) => void;
  /** No celular a linha não se edita no lugar: ela abre em tela cheia. */
  onEditar: (chave: number) => void;
  /** Sem ele, a colagem de várias células fica com o navegador (a ficha do pedido não importa lista). */
  onColar?: (texto: string, foco: Celula | null) => void;
  /** Sem ele, o botão "Colar lista" não aparece. */
  onColarLista?: () => void;
  /** O nome digitado que não está no catálogo, para cadastrar e voltar escolhido na linha. */
  onCriarEspecie: (chave: number, nome: string) => void;
  /**
   * Só a ficha, no pedido que voltou da verificação: o que ela achou de cada
   * linha (a barra e a frase), por chave. O cadastro novo não tem.
   */
  conferencia?: Readonly<Record<number, ConferenciaDaLinha>>;
  /** O pedido original do item dividido, em linha de leitura antes da chave. */
  pais?: Readonly<Record<number, LinhaLeitura>>;
  /** As espécies que a verificação pôs no genérico, em linhas de leitura depois da chave. */
  filhos?: Readonly<Record<number, readonly LinhaLeitura[]>>;
}

const rotuloCriarEspecie = (nome: string) => `+ Cadastrar "${nome}" como espécie nova`;

const COR_RESUMO: Record<ConferenciaDaLinha['estado'], string> = {
  tudo: 'text-green-800',
  parte: 'text-amber-800',
  nao_tem: 'text-red-700',
};

const detalhe = (linha: LinhaLeitura) => [linha.recipiente, linha.altura].filter(Boolean).join(' · ');

const COR_TEMOS = (completo: boolean | undefined) => (completo ? 'text-green-300' : 'text-amber-300');

/** O que o cliente pediu no item que a verificação dividiu: cinza escuro, barra azul, sem campo. */
function LinhaPaiPlanilha({ pai }: { pai: LinhaLeitura }) {
  return (
    <tr className={`border-t border-line align-top ${CLASSE_LINHA_PAI}`}>
      <td className="px-3 py-2.5">
        <span className="font-semibold">{pai.nome}</span>
        <span className="block text-xs text-gray-300">Pedido do cliente</span>
        {pai.temos && <span className={`block text-sm font-semibold ${COR_TEMOS(pai.completo)}`}>{pai.temos}</span>}
      </td>
      <td className="border-l border-gray-600 px-3 py-2.5">{pai.recipiente}</td>
      <td className="border-l border-gray-600 px-3 py-2.5">{pai.altura}</td>
      <td className="border-l border-gray-600 px-3 py-2.5 text-right">
        {pai.quantidade === null ? null : formatQuantidade(pai.quantidade)}
      </td>
      <td className="border-l border-gray-600" />
    </tr>
  );
}

function LinhaPaiLista({ pai }: { pai: LinhaLeitura }) {
  return (
    <li className={`flex flex-col gap-0.5 px-4 py-3 ${CLASSE_LINHA_PAI}`}>
      <span className="grid grid-cols-[1fr_auto] items-start gap-x-3">
        <span className="text-base font-semibold">{pai.nome}</span>
        {pai.quantidade !== null && <span className="text-base font-semibold">{formatQuantidade(pai.quantidade)}</span>}
      </span>
      <span className="text-sm text-gray-300">Pedido do cliente{detalhe(pai) ? `: ${detalhe(pai)}` : ''}</span>
      {pai.temos && <span className={`text-sm font-semibold ${COR_TEMOS(pai.completo)}`}>{pai.temos}</span>}
    </li>
  );
}

/** A espécie que a verificação pôs no genérico: só leitura, porque quem a escolheu foi a verificação. */
function LinhaFilhaPlanilha({ filho }: { filho: LinhaLeitura }) {
  return (
    <tr className={`border-t border-line bg-gray-50 align-top ${BARRA_CONFERENCIA.tudo}`}>
      <td className="px-3 py-2.5 pl-7">
        <span className="text-muted">↳ </span>
        <span className="font-semibold text-ink">{filho.nome}</span>
      </td>
      <td className="border-l border-line px-3 py-2.5">{filho.recipiente}</td>
      <td className="border-l border-line px-3 py-2.5">{filho.altura}</td>
      <td className="border-l border-line px-3 py-2.5 text-right">
        {filho.quantidade === null ? null : formatQuantidade(filho.quantidade)}
      </td>
      <td className="border-l border-line" />
    </tr>
  );
}

function LinhaFilhaLista({ filho }: { filho: LinhaLeitura }) {
  return (
    <li className={`grid grid-cols-[1fr_auto] items-start gap-x-3 bg-gray-50 py-3 pr-4 pl-8 ${BARRA_CONFERENCIA.tudo}`}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-base font-semibold text-ink">↳ {filho.nome}</span>
        {detalhe(filho) && <span className="text-sm text-muted">{detalhe(filho)}</span>}
      </span>
      {filho.quantidade !== null && (
        <span className="text-base font-semibold text-ink">{formatQuantidade(filho.quantidade)}</span>
      )}
    </li>
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
 *
 * **O pedido que voltou da verificação não a esquece**: cada linha tem a barra
 * da resposta (verde, amarelo, vermelho) e a frase do que foi achado, o item
 * dividido ganha a linha pai com o que o cliente pediu, e o genérico mostra as
 * espécies que o compuseram. Mudar a linha derruba a resposta, e a barra some.
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
  conferencia = {},
  pais = {},
  filhos = {},
}: GradeItensProps) {
  const [foco, setFoco] = useState<Celula | null>(null);

  /**
   * Ctrl+V na planilha. O texto decide para onde vai, e a decisão é de quem
   * chamou: aqui só se descobre em que célula o cursor estava.
   */
  function aoColar(evento: ClipboardEvent<HTMLDivElement>) {
    const texto = evento.clipboardData.getData('text/plain');
    if (!texto || !onColar) return;
    const varias = texto.includes('\t') || /\r?\n.*\S/.test(texto.trim());
    // Uma célula só é colagem comum, e o navegador faz melhor que nós
    if (!varias) return;
    evento.preventDefault();
    onColar(texto, foco);
  }

  /**
   * O genérico é a primeira opção da espécie, e escolhido fica no campo como
   * qualquer espécie: a escolha de verdade fica para a conferência.
   */
  const opcaoGenerico = (linha: Linha) => ({
    rotulo: 'Genérico',
    ativa: linha.generico,
    onEscolher: () => {
      onAlterar(linha.chave, 'especieId', '');
      onAlterar(linha.chave, 'generico', true);
    },
  });

  /** Espécie escolhida ou digitação que desfaz a escolha: nos dois casos a linha deixa de ser genérica, e perde o grupo. */
  function escolherEspecie(linha: Linha, valor: string) {
    if (linha.generico) {
      onAlterar(linha.chave, 'generico', false);
      onAlterar(linha.chave, 'grupo', []);
    }
    onAlterar(linha.chave, 'especieId', valor);
  }

  function saldoDa(linha: Linha) {
    const altura = parseAltura(linha.altura);
    const saldo = saldoDoItem(saldos[chaveSaldo(linha.especieId, linha.recipienteId)], 'error' in altura ? null : altura.value);
    const quantidade = lerQuantidade(linha.quantidade);
    const confirmada = conferencia[linha.chave]?.confirmada ?? null;
    const falta = Boolean(linha.especieId && linha.recipienteId && faltaNoItem(saldo, quantidade, confirmada) > 0);
    return { saldo, quantidade, confirmada, falta };
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
          {/* O grupo cabe numa posição só da lista paralela: os ids, separados por vírgula */}
          <input type="hidden" name="item_especies_permitidas" value={especiesDoGrupo(linha).join(',')} />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Itens</h2>
        {onColarLista && (
          <Button variant="outline" className="h-9 min-h-0! w-auto! shrink-0 px-3! text-sm!" onClick={onColarLista}>
            📋 Colar lista
          </Button>
        )}
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
              {/* A célula tem o rótulo só para leitor de tela: a marca de obrigatório fica no cabeçalho */}
              <th scope="col" className={`rounded-tl-xl px-3 py-2 ${MARCA_OBRIGATORIO}`}>
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
              const { saldo, quantidade, confirmada, falta } = saldoDa(linha);
              const conferida = conferencia[linha.chave];
              return (
                <Fragment key={linha.chave}>
                  {pais[linha.chave] && <LinhaPaiPlanilha pai={pais[linha.chave]} />}
                  <tr className={`border-t border-line align-top ${linha.generico ? 'bg-blue-50' : ''}`}>
                    {/* O foco marca em que célula a colagem começa, e o `onFocus`
                      da célula vale para o campo de dentro, qualquer que ele seja */}
                    <td
                      className={`p-0 ${conferida ? BARRA_CONFERENCIA[conferida.estado] : ''}`}
                      onFocus={() => setFoco({ linha: indice, coluna: 0 })}
                    >
                      <ComboboxField
                        label={`Espécie do item ${indice + 1}`}
                        compacto
                        options={opcoesEspecie}
                        value={linha.especieId}
                        onChange={(valor) => escolherEspecie(linha, valor)}
                        onCriarNova={(nome) => onCriarEspecie(linha.chave, nome)}
                        rotuloCriar={rotuloCriarEspecie}
                        opcaoFixa={opcaoGenerico(linha)}
                        placeholder="Digite o nome…"
                      />
                      {/* O genérico pode restringir as espécies: só estas aparecem na conferência */}
                      {linha.generico && (
                        <GrupoEspecies
                          doItem={`do item ${indice + 1}`}
                          compacto
                          grupo={linha.grupo}
                          opcoesEspecie={opcoesEspecie}
                          onAlterar={(grupo) => onAlterar(linha.chave, 'grupo', grupo)}
                        />
                      )}
                      {/* O genérico pode levar uma observação: é o texto que a gerência lê para montar o item */}
                      {linha.generico && (
                        <TextField
                          label={`Observação do item ${indice + 1}`}
                          compacto
                          autoComplete="off"
                          placeholder="Observação"
                          value={linha.especificacao}
                          onChange={(evento) => onAlterar(linha.chave, 'especificacao', evento.target.value)}
                        />
                      )}
                      {/* RF-56: o saldo não é coluna, é a linha miúda embaixo da espécie */}
                      {linha.especieId && linha.recipienteId && (
                        <p className={`px-3 pb-1.5 text-xs ${falta ? 'font-semibold text-amber-800' : 'text-muted'}`}>
                          {textoSaldo(saldo, quantidade, confirmada)}
                        </p>
                      )}
                      {conferida && (
                        <p className={`px-3 pb-1.5 text-xs font-semibold ${COR_RESUMO[conferida.estado]}`}>{conferida.resumo}</p>
                      )}
                    </td>
                    <td className="border-l border-line p-0" onFocus={() => setFoco({ linha: indice, coluna: 1 })}>
                      <ComboboxField
                        label={`Recipiente do item ${indice + 1}`}
                        compacto
                        options={recipientes}
                        value={linha.recipienteId}
                        onChange={(valor) => onAlterar(linha.chave, 'recipienteId', valor)}
                        placeholder=""
                      />
                    </td>
                    <td className="border-l border-line p-0">
                      <TextField
                        label={`Altura do item ${indice + 1}, em metros`}
                        compacto
                        inputMode="numeric"
                        autoComplete="off"
                        value={linha.altura}
                        onFocus={() => setFoco({ linha: indice, coluna: 2 })}
                        onChange={(evento) => onAlterar(linha.chave, 'altura', mascaraAltura(evento.target.value, linha.altura))}
                      />
                    </td>
                    <td className="border-l border-line p-0">
                      <TextField
                        label={`Quantidade do item ${indice + 1}`}
                        compacto
                        className="[&_input]:text-right"
                        inputMode="numeric"
                        autoComplete="off"
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
                  {filhos[linha.chave]?.map((filho) => (
                    <LinhaFilhaPlanilha key={filho.id} filho={filho} />
                  ))}
                </Fragment>
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
            const especie = linha.generico ? rotuloGenerico(linha.especificacao) : (opcaoEspecie?.label ?? null);
            const recipiente = rotulo(recipientes, linha.recipienteId);
            const conferida = conferencia[linha.chave];
            return (
              <Fragment key={linha.chave}>
                {pais[linha.chave] && <LinhaPaiLista pai={pais[linha.chave]} />}
                <li className={`${linha.generico ? 'bg-blue-50' : ''} ${conferida ? BARRA_CONFERENCIA[conferida.estado] : ''}`}>
                  <button
                    type="button"
                    onClick={() => onEditar(linha.chave)}
                    className="grid min-h-touch w-full grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-3 text-left active:bg-brand-light"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-base font-semibold text-ink">{especie ?? `Item ${indice + 1}, sem espécie`}</span>
                      {opcaoEspecie?.detalhe && <span className="text-xs text-muted italic">{opcaoEspecie.detalhe}</span>}
                      <span className="text-sm text-muted">
                        {[
                          recipiente,
                          linha.altura && normalizaCampoAltura(linha.altura),
                          rotuloGrupo(especiesDoGrupo(linha).length),
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Toque para preencher'}
                      </span>
                      {conferida && (
                        <span className={`text-xs font-semibold ${COR_RESUMO[conferida.estado]}`}>{conferida.resumo}</span>
                      )}
                    </span>
                    <span className={`text-base font-semibold ${falta ? 'text-amber-800' : 'text-ink'}`}>
                      {quantidade === null ? '—' : formatQuantidade(quantidade)}
                    </span>
                  </button>
                </li>
                {filhos[linha.chave]?.map((filho) => (
                  <LinhaFilhaLista key={filho.id} filho={filho} />
                ))}
              </Fragment>
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
