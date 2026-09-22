'use client';

import { useActionState, useState } from 'react';
import { adicionarNomePopularAction } from '@/app/(sistema)/cadastros/especies/acoes-rapidas';
import { EspecieRapida } from '@/components/EspecieRapida';
import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Notice } from '@/components/ui/Notice';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_NOME_POPULAR_STATE, type EspecieRef } from '@/lib/especies-form';
import { normalizeNomePopular } from '@/lib/especies-nomes';
import { type EspecieParaColagem, type SituacaoCasamento, montaLinhasColadas } from '@/lib/pedidos-colagem';

export interface ItemImportado {
  generico: boolean;
  especieId: string;
  especie: string;
  recipienteId: string;
  /** Texto: o formulário do pedido trabalha com campos controlados. */
  quantidade: string;
}

interface ColarListaProps {
  especies: readonly EspecieParaColagem[];
  recipientes: readonly SelectOption[];
  onImportar: (itens: ItemImportado[]) => void;
  /** A espécie criada aqui precisa entrar na lista do formulário também. */
  onEspecieNova: (especie: EspecieRef) => void;
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
  quantidade: string;
}

const TOM: Record<SituacaoCasamento, PillTone> = { exata: 'green', provavel: 'amber', nenhuma: 'red' };
const ROTULO: Record<SituacaoCasamento, string> = { exata: '✓ exata', provavel: '⚠ provável', nenhuma: '✗ resolver' };

const EXEMPLO = 'Cole aqui, uma espécie por linha. Ex:\nIpê amarelo 500\n200 araucária\npitanga - 100';

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
export function ColarLista({ especies, recipientes, onImportar, onEspecieNova, onFechar }: ColarListaProps) {
  const [catalogo, setCatalogo] = useState<EspecieParaColagem[]>([...especies]);
  const [recipientePadrao, setRecipientePadrao] = useState(recipientes.length === 1 ? recipientes[0].value : '');
  const [texto, setTexto] = useState('');
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

  const opcoesEspecie: SelectOption[] = catalogo.map((especie) => ({ value: especie.id, label: especie.nome }));

  function reconhecer() {
    if (!recipientePadrao) {
      setErro('Escolha o recipiente padrão antes de reconhecer.');
      return;
    }
    const lidas = montaLinhasColadas(texto, catalogo);
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
        recipienteId: recipientePadrao,
        quantidade: linha.quantidade === null ? '' : String(linha.quantidade),
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

  function trocarRecipientePadrao(valor: string) {
    setRecipientePadrao(valor);
    setLinhas((atuais) => atuais?.map((linha) => ({ ...linha, recipienteId: valor })) ?? null);
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

  const pendentes = (linhas ?? []).filter(
    (linha) => (!linha.generico && !linha.especieId) || !linha.recipienteId || !/^\d+$/.test(linha.quantidade.trim()),
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
          placeholder="Escolha"
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
    <section className="flex flex-col gap-3 rounded-xl border-2 border-brand bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-ink">Conferir o que foi lido</h3>
        <Button variant="secondary" onClick={onFechar}>
          Fechar
        </Button>
      </div>

      <SelectField
        label="Recipiente padrão (vale para todas)"
        name="colagem_recipiente"
        options={recipientes}
        value={recipientePadrao}
        onChange={(event) => trocarRecipientePadrao(event.target.value)}
      />

      <ul className="flex flex-col gap-3">
        {linhas.map((linha) => {
          const falta = !linha.generico && !linha.especieId;
          const especie = catalogo.find((candidata) => candidata.id === linha.especieId);
          const podeAprender =
            linha.resolvidaAMao && !!linha.especieId && !linha.nomeAprendido && !jaConhece(especie, linha.nomeColado);

          return (
            <li
              key={linha.chave}
              className={`flex flex-col gap-2 rounded-xl border-2 p-3 ${
                linha.generico ? 'border-blue-400 bg-blue-50' : falta ? 'border-red-400 bg-red-50' : 'border-line bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm text-muted" title={linha.bruta}>
                  {linha.bruta}
                </p>
                <button
                  type="button"
                  aria-label={`Tirar a linha ${linha.bruta}`}
                  onClick={() => setLinhas((atuais) => atuais?.filter((atual) => atual.chave !== linha.chave) ?? null)}
                  className="min-h-touch px-2 text-base font-bold text-muted"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={falta ? 'red' : TOM[linha.situacao]}>{ROTULO[falta ? 'nenhuma' : linha.situacao]}</Pill>
                <Button
                  variant={linha.generico ? 'primary' : 'secondary'}
                  onClick={() =>
                    alterar(linha.chave, {
                      generico: !linha.generico,
                      especieId: '',
                      especie: '',
                      resolvidaAMao: false,
                    })
                  }
                >
                  {linha.generico ? 'GENÉRICO' : 'tornar genérico'}
                </Button>
              </div>

              {linha.generico ? (
                <p className="text-sm font-semibold text-blue-900">A gerência escolhe a espécie na conferência.</p>
              ) : (
                <ComboboxField
                  label="Espécie"
                  name={`colagem_especie_${linha.chave}`}
                  options={opcoesEspecie}
                  value={linha.especieId}
                  onChange={(valor) => escolherEspecie(linha, valor)}
                />
              )}

              {!linha.generico && linha.casouPor && (
                <p className="text-sm text-muted">reconhecido por &quot;{linha.casouPor}&quot;</p>
              )}

              {!linha.generico && !linha.especieId && (
                <Button variant="outline" onClick={() => setCriandoPara(linha)}>
                  + Cadastrar &quot;{linha.nomeColado}&quot; como espécie nova
                </Button>
              )}

              {podeAprender && (
                <form action={aprender}>
                  <input type="hidden" name="especie_id" value={linha.especieId} />
                  <input type="hidden" name="nome" value={linha.nomeColado} />
                  <Button type="submit" variant="outline" pending={aprendendo}>
                    + Salvar &quot;{linha.nomeColado}&quot; como outro nome de {linha.especie}
                  </Button>
                </form>
              )}
              {linha.nomeAprendido && (
                <p className="text-sm font-semibold text-green-800">
                  ✓ &quot;{linha.nomeColado}&quot; salvo como outro nome
                </p>
              )}

              <TextField
                label="Quantidade"
                name={`colagem_quantidade_${linha.chave}`}
                inputMode="numeric"
                autoComplete="off"
                value={linha.quantidade}
                onChange={(event) => alterar(linha.chave, { quantidade: event.target.value })}
              />
            </li>
          );
        })}
      </ul>

      {aprendizado.error && <Notice tone="error">{aprendizado.error}</Notice>}

      {pendentes > 0 ? (
        <Notice tone="warning">
          {pendentes === 1
            ? 'Uma linha a resolver: falta a espécie ou a quantidade.'
            : `${pendentes} linhas a resolver: falta a espécie ou a quantidade.`}
        </Notice>
      ) : (
        <Button
          onClick={() =>
            onImportar(
              linhas.map((linha) => ({
                generico: linha.generico,
                especieId: linha.especieId,
                especie: linha.especie,
                recipienteId: linha.recipienteId,
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
