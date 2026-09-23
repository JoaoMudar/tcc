'use client';

import { useActionState, useState } from 'react';
import { adicionarNomePopularAction } from '@/app/(sistema)/cadastros/especies/acoes-rapidas';
import { EspecieRapida } from '@/components/EspecieRapida';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_NOME_POPULAR_STATE, type EspecieRef } from '@/lib/especies-form';
import { normalizeNomePopular } from '@/lib/especies-nomes';
import { formatAltura, formatMoeda, normalizaCampoAltura, parseAltura } from '@/lib/pedidos-rotulos';
import { type EspecieParaColagem, type SituacaoCasamento, montaLinhasColadas } from '@/lib/pedidos-colagem';

export interface ItemImportado {
  generico: boolean;
  especieId: string;
  especie: string;
  /** No genérico, a linha colada: é o que o cliente pediu, nas palavras dele. */
  especificacao: string;
  /** Vazio é "o cliente não disse o tamanho". */
  recipienteId: string;
  /** Texto: o formulário do pedido trabalha com campos controlados. */
  altura: string;
  quantidade: string;
}

interface ColarListaProps {
  especies: readonly EspecieParaColagem[];
  recipientes: readonly SelectOption[];
  onImportar: (itens: ItemImportado[]) => void;
  /** A espécie criada aqui precisa entrar na lista do formulário também. */
  onEspecieNova: (especie: EspecieRef) => void;
  /** O texto que já veio colado na planilha, quando a colagem caiu aqui pelo Ctrl+V. */
  textoInicial?: string;
  onFechar: () => void;
}

interface LinhaRevisao {
  chave: number;
  bruta: string;
  nomeColado: string;
  situacao: SituacaoCasamento;
  casouPor: string | null;
  /** A espécie foi escolhida à mão, e o nome colado pode virar sinônimo. */
  resolvidaAMao: boolean;
  nomeAprendido: boolean;
  generico: boolean;
  especieId: string;
  especie: string;
  recipienteId: string;
  /** O recipiente veio do padrão do cabeçalho, e acompanha quando ele muda. */
  segueOPadrao: boolean;
  altura: string;
  quantidade: string;
  /** O preço que veio na lista, só para mostrar que foi visto e ficou de fora (RN-50). */
  precoCentavos: number | null;
}

const EXEMPLO =
  'Cole aqui, uma espécie por linha ou separadas por "|". Ex:\nIpê amarelo 500\nGuabiroba - 60 cm - R$ 10,00\n200 araucária tubete\npitanga 80-100cm | ingá 1,20 m';

/** A espécie já conhece o texto colado? Então não há nome novo a aprender. */
function jaConhece(especie: EspecieParaColagem | undefined, nome: string): boolean {
  if (!especie) return true;
  const alvo = normalizeNomePopular(nome);
  const nomes = [especie.nome, especie.nomeCientifico ?? '', ...(especie.nomesPopulares ?? [])];
  return nomes.some((candidato) => normalizeNomePopular(candidato) === alvo);
}

/**
 * T8.16, UC-31: a lista do WhatsApp virando itens do pedido.
 *
 * Duas etapas, e a segunda é a razão de a primeira existir: **nada entra no
 * pedido sem passar pelos olhos de alguém**. O reconhecimento acerta a maioria
 * das linhas e erra algumas, e quem cadastra é quem decide.
 *
 * O sistema aprende: o nome corrigido à mão pode virar outro nome da espécie, e
 * a próxima lista com aquele mesmo apelido é reconhecida sozinha.
 */
export function ColarLista({
  especies,
  recipientes,
  textoInicial = '',
  onImportar,
  onEspecieNova,
  onFechar,
}: ColarListaProps) {
  const [catalogo, setCatalogo] = useState<EspecieParaColagem[]>([...especies]);
  const [recipientePadrao, setRecipientePadrao] = useState(recipientes.length === 1 ? recipientes[0].value : '');
  const [texto, setTexto] = useState(textoInicial);
  const [linhas, setLinhas] = useState<LinhaRevisao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criandoPara, setCriandoPara] = useState<LinhaRevisao | null>(null);

  const [aprendizado, aprender, aprendendo] = useActionState(adicionarNomePopularAction, EMPTY_NOME_POPULAR_STATE);

  // O nome aprendido entra no catálogo local: o próximo "Reconhecer" desta mesma
  // sessão já o encontra, sem recarregar a página. É ajuste de estado derivado
  // da resposta da action, feito na renderização como no `ComboboxField`, e não
  // num efeito: efeito é para falar com o mundo de fora, não consigo mesmo.
  const salvo = aprendizado.nomeSalvo;
  const chaveAprendida = salvo ? `${salvo.especieId}:${salvo.nome}` : null;
  const [ultimoAprendido, setUltimoAprendido] = useState<string | null>(null);
  if (salvo && chaveAprendida !== ultimoAprendido) {
    setUltimoAprendido(chaveAprendida);
    setCatalogo((atuais) =>
      atuais.map((especie) =>
        especie.id === salvo.especieId
          ? { ...especie, nomesPopulares: [...(especie.nomesPopulares ?? []), salvo.nome] }
          : especie,
      ),
    );
    setLinhas(
      (atuais) =>
        atuais?.map((linha) =>
          linha.especieId === salvo.especieId &&
          normalizeNomePopular(linha.nomeColado) === normalizeNomePopular(salvo.nome)
            ? { ...linha, nomeAprendido: true }
            : linha,
        ) ?? null,
    );
  }

  const opcoesEspecie: SelectOption[] = catalogo.map((especie) => ({
    value: especie.id,
    label: especie.nome,
    detalhe: especie.nomeCientifico && especie.nomeCientifico !== especie.nome ? especie.nomeCientifico : undefined,
  }));

  function reconhecer() {
    const lidas = montaLinhasColadas(
      texto,
      catalogo,
      recipientes.map((opcao) => ({ id: opcao.value, nome: opcao.label })),
    );
    if (lidas.length === 0) {
      setErro('Nada reconhecido. Cole uma linha por espécie, ex: "Ipê amarelo 500".');
      return;
    }
    setErro(null);
    setLinhas(
      lidas.map((linha, indice) => ({
        chave: indice + 1,
        bruta: linha.bruta,
        nomeColado: linha.nome,
        situacao: linha.casamento.situacao,
        casouPor: linha.casamento.casouPor ?? null,
        resolvidaAMao: false,
        nomeAprendido: false,
        generico: false,
        especieId: linha.casamento.especieId ?? '',
        especie: linha.casamento.especie ?? '',
        recipienteId: linha.recipienteId ?? recipientePadrao,
        segueOPadrao: !linha.recipienteId,
        altura: formatAltura(linha.alturaM),
        quantidade: linha.quantidade === null ? '' : String(linha.quantidade),
        precoCentavos: linha.precoCentavos,
      })),
    );
  }

  function alterar(chave: number, mudanca: Partial<LinhaRevisao>) {
    setLinhas((atuais) => atuais?.map((linha) => (linha.chave === chave ? { ...linha, ...mudanca } : linha)) ?? null);
  }

  function escolherEspecie(linha: LinhaRevisao, especieId: string) {
    const especie = catalogo.find((candidata) => candidata.id === especieId);
    alterar(linha.chave, {
      especieId,
      especie: especie?.nome ?? '',
      generico: false,
      resolvidaAMao: true,
      nomeAprendido: false,
      situacao: especieId ? 'exata' : 'nenhuma',
      casouPor: null,
    });
  }

  /** Troca só as linhas que ainda estavam no padrão: o recipiente lido na lista ou escolhido à mão fica. */
  function trocarRecipientePadrao(valor: string) {
    setRecipientePadrao(valor);
    setLinhas(
      (atuais) => atuais?.map((linha) => (linha.segueOPadrao ? { ...linha, recipienteId: valor } : linha)) ?? null,
    );
  }

  function aoCriarEspecie(especie: EspecieRef) {
    setCatalogo((atuais) =>
      atuais.some((atual) => atual.id === especie.id)
        ? atuais
        : [
            ...atuais,
            {
              id: especie.id,
              nome: especie.nome,
              nomeCientifico: especie.nomeCientifico,
              nomesPopulares: especie.nomesPopulares,
            },
          ],
    );
    onEspecieNova(especie);
    if (criandoPara) {
      alterar(criandoPara.chave, {
        especieId: especie.id,
        especie: especie.nome,
        generico: false,
        resolvidaAMao: false,
        situacao: 'exata',
        casouPor: null,
      });
    }
    setCriandoPara(null);
  }

  // Recipiente e quantidade em branco não travam: no cadastro são opcionais, e a
  // conferência responde o que o cliente não disse
  const pendentes = (linhas ?? []).filter(
    (linha) =>
      (!linha.generico && !linha.especieId) ||
      'error' in parseAltura(linha.altura) ||
      (linha.quantidade.trim() !== '' && !/^\d+$/.test(linha.quantidade.trim())),
  ).length;

  if (linhas === null) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border-2 border-brand bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">Colar lista do WhatsApp</h3>
          <Button variant="secondary" onClick={onFechar}>
            Fechar
          </Button>
        </div>
        <SelectField
          label="Recipiente padrão (vale para todas)"
          name="colagem_recipiente"
          options={recipientes}
          placeholder="a definir"
          value={recipientePadrao}
          onChange={(event) => setRecipientePadrao(event.target.value)}
        />
        <TextArea
          label="Lista do cliente"
          name="colagem_texto"
          rows={8}
          placeholder={EXEMPLO}
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
        />
        {erro && <Notice tone="error">{erro}</Notice>}
        <Button onClick={reconhecer}>Reconhecer →</Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border-2 border-brand bg-white p-3 sm:p-4">
      {/* O recipiente padrão fica no cabeçalho: ele vale para a grade inteira */}
      <div className="flex flex-wrap items-end gap-3">
        <h3 className="w-full text-base font-bold text-ink sm:w-auto sm:flex-1">Conferir o que foi lido</h3>
        <div className="min-w-0 flex-1 sm:max-w-xs sm:flex-none">
          <SelectField
            label="Recipiente padrão (vale para todas)"
            name="colagem_recipiente"
            options={recipientes}
            value={recipientePadrao}
            onChange={(event) => trocarRecipientePadrao(event.target.value)}
          />
        </div>
        <Button variant="secondary" className="w-auto!" onClick={onFechar}>
          Fechar
        </Button>
      </div>

      {/* A mesma grade dos itens do pedido, nas mesmas colunas. A célula da
          espécie diz de longe o que falta: verde achou, vermelho não achou, azul
          é o genérico. Sem `overflow-hidden`, pela mesma razão da planilha: a
          lista de opções passa por cima da borda de baixo.
          Abaixo de `lg` cada linha vira um bloco: a espécie ocupa a largura toda
          e recipiente, altura e quantidade ficam lado a lado embaixo, porque seis
          colunas em 360px seriam alvos menores que o dedo (RNF-03) */}
      <div className="rounded-xl border border-line bg-white">
        <table className="w-full border-collapse text-base max-lg:block lg:table-fixed">
          <colgroup>
            <col />
            <col className="w-44" />
            <col className="w-28" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-12" />
          </colgroup>
          <thead className="max-lg:hidden">
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
                Qtd
              </th>
              <th scope="col" className="border-l border-line px-1 py-2 text-center">
                Genérico
              </th>
              <th scope="col" className="rounded-tr-xl border-l border-line">
                <span className="sr-only">Excluir</span>
              </th>
            </tr>
          </thead>
          <tbody className="max-lg:block">
            {linhas.map((linha, indice) => {
              const achou = linha.generico || !!linha.especieId;
              const especie = catalogo.find((candidata) => candidata.id === linha.especieId);
              const podeAprender =
                linha.resolvidaAMao &&
                !!linha.especieId &&
                !!linha.nomeColado &&
                !linha.nomeAprendido &&
                !jaConhece(especie, linha.nomeColado);

              return (
                <tr
                  key={linha.chave}
                  className="grid grid-cols-[1.4fr_1fr_1fr_2.75rem_2.75rem] border-t border-line first:border-t-0 lg:table-row lg:align-top lg:first:border-t"
                >
                  <td
                    data-situacao={linha.generico ? 'generico' : achou ? 'encontrada' : 'nao-encontrada'}
                    className={`col-span-5 border-l-4 p-0 ${
                      linha.generico
                        ? 'border-l-blue-500 bg-blue-50'
                        : achou
                          ? 'border-l-green-600 bg-green-50'
                          : 'border-l-red-600 bg-red-50'
                    }`}
                  >
                    {linha.generico ? (
                      <p className="flex min-h-11 items-center px-3 font-semibold text-blue-900">
                        Espécie a definir na conferência
                      </p>
                    ) : (
                      <ComboboxField
                        label={`Espécie da linha ${indice + 1}`}
                        compacto
                        options={opcoesEspecie}
                        value={linha.especieId}
                        onChange={(valor) => escolherEspecie(linha, valor)}
                        placeholder="Digite o nome…"
                      />
                    )}

                    {/* O que veio colado fica à vista: é contra ele que se confere o reconhecimento */}
                    <p className="truncate px-3 pb-1.5 text-xs text-muted" title={linha.bruta}>
                      lido: &quot;{linha.bruta}&quot;
                      {!linha.generico && linha.casouPor && ` · reconhecido por "${linha.casouPor}"`}
                    </p>
                    {/* RN-50: o preço é visto e deixado de lado, e a pessoa fica sabendo */}
                    {linha.precoCentavos !== null && (
                      <p className="px-3 pb-1.5 text-xs text-muted">
                        {formatMoeda(linha.precoCentavos)} não entra no pedido: o preço é lançado depois da conferência
                      </p>
                    )}

                    {!linha.generico && !linha.especieId && linha.nomeColado && (
                      <button
                        type="button"
                        onClick={() => setCriandoPara(linha)}
                        className="px-3 pb-2 text-left text-sm font-bold text-brand underline"
                      >
                        + Cadastrar &quot;{linha.nomeColado}&quot; como espécie nova
                      </button>
                    )}

                    {podeAprender && (
                      <form action={aprender} className="px-3 pb-2">
                        <input type="hidden" name="especie_id" value={linha.especieId} />
                        <input type="hidden" name="nome" value={linha.nomeColado} />
                        <button
                          type="submit"
                          disabled={aprendendo}
                          className="text-left text-sm font-bold text-brand underline disabled:opacity-60"
                        >
                          + Salvar &quot;{linha.nomeColado}&quot; como outro nome de {linha.especie}
                        </button>
                      </form>
                    )}
                    {linha.nomeAprendido && (
                      <p className="px-3 pb-2 text-sm font-semibold text-green-800">
                        ✓ &quot;{linha.nomeColado}&quot; salvo como outro nome
                      </p>
                    )}
                  </td>
                  <td className="min-w-0 border-line p-0 max-lg:border-t lg:border-l">
                    <ComboboxField
                      label={`Recipiente da linha ${indice + 1}`}
                      compacto
                      options={recipientes}
                      value={linha.recipienteId}
                      onChange={(valor) => alterar(linha.chave, { recipienteId: valor, segueOPadrao: false })}
                      placeholder="Recipiente"
                    />
                  </td>
                  <td className="min-w-0 border-l border-line p-0 max-lg:border-t">
                    <TextField
                      label={`Altura da linha ${indice + 1}`}
                      compacto
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Altura"
                      value={linha.altura}
                      onChange={(event) => alterar(linha.chave, { altura: event.target.value })}
                      onBlur={(event) => alterar(linha.chave, { altura: normalizaCampoAltura(event.target.value) })}
                    />
                  </td>
                  <td className="min-w-0 border-l border-line p-0 max-lg:border-t">
                    <TextField
                      label={`Quantidade da linha ${indice + 1}`}
                      compacto
                      className="[&_input]:text-right"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Qtd"
                      value={linha.quantidade}
                      onChange={(event) => alterar(linha.chave, { quantidade: event.target.value })}
                    />
                  </td>
                  <td className="border-l border-line p-0 max-lg:border-t">
                    <label className="flex h-11 w-full cursor-pointer items-center justify-center">
                      <span className="sr-only">Tornar genérico o item da linha {indice + 1}</span>
                      <input
                        type="checkbox"
                        className="size-5 accent-blue-700"
                        checked={linha.generico}
                        onChange={(event) =>
                          alterar(linha.chave, {
                            generico: event.target.checked,
                            especieId: '',
                            especie: '',
                            resolvidaAMao: false,
                          })
                        }
                      />
                    </label>
                  </td>
                  <td className="border-l border-line p-0 max-lg:border-t">
                    <button
                      type="button"
                      aria-label={`Tirar a linha ${linha.bruta}`}
                      title="Tirar linha"
                      onClick={() => setLinhas((atuais) => atuais?.filter((atual) => atual.chave !== linha.chave) ?? null)}
                      className="flex h-11 w-full items-center justify-center font-bold text-muted hover:bg-red-50 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {aprendizado.error && <Notice tone="error">{aprendizado.error}</Notice>}

      {pendentes > 0 ? (
        <Notice tone="warning">
          {pendentes === 1
            ? 'Uma linha a resolver: falta a espécie, ou a altura ou a quantidade não se entende.'
            : `${pendentes} linhas a resolver: falta a espécie, ou a altura ou a quantidade não se entende.`}
        </Notice>
      ) : (
        <Button
          onClick={() =>
            onImportar(
              linhas.map((linha) => ({
                generico: linha.generico,
                especieId: linha.especieId,
                especie: linha.especie,
                especificacao: linha.generico ? linha.bruta.trim() : '',
                recipienteId: linha.recipienteId,
                altura: normalizaCampoAltura(linha.altura.trim()),
                quantidade: linha.quantidade.trim(),
              })),
            )
          }
        >
          Adicionar {linhas.length} {linhas.length === 1 ? 'item' : 'itens'} ao pedido
        </Button>
      )}

      {criandoPara && (
        <EspecieRapida
          nomeSugerido={criandoPara.nomeColado}
          onCriada={aoCriarEspecie}
          onFechar={() => setCriandoPara(null)}
        />
      )}
    </section>
  );
}
