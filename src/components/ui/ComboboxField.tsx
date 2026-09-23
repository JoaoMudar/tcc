'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { filtraOpcoes, normalizeTexto } from '@/lib/busca-opcoes';
import type { SelectOption } from './SelectField';

/** Mais do que isto vira rolagem dentro de rolagem na tela do celular. */
const MAX_VISIVEL = 8;

interface ComboboxFieldProps {
  label: string;
  /**
   * Sem `name` o campo não entra no formulário: é o caso da planilha de itens,
   * que emite os próprios campos escondidos, um bloco por linha.
   */
  name?: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  /**
   * Célula de planilha: rótulo só para leitor de tela, sem as linhas de apoio
   * embaixo, e a lista de opções flutuando sobre as linhas seguintes em vez de
   * empurrá-las para baixo.
   */
  compacto?: boolean;
  /**
   * Obrigatório na validação do navegador. Vai no campo visível, porque o
   * escondido não é validado: sem isto o envio vazio só é barrado no servidor,
   * e o campo não fica marcado junto com os outros que faltam.
   */
  required?: boolean;
  /**
   * Texto que não achou nada na lista pode virar cadastro novo: com esta prop,
   * a lista aberta termina num botão que entrega o texto digitado a quem chamou.
   */
  onCriarNova?: (texto: string) => void;
  /** O rótulo desse botão. */
  rotuloCriar?: (texto: string) => string;
  /**
   * Escolha que não é da lista e vem sempre primeiro, qualquer que seja o texto
   * digitado: é o item genérico do pedido, cuja espécie se decide depois.
   */
  opcaoFixa?: { rotulo: string; onEscolher: () => void };
}

/**
 * Lista fechada que se digita (RNF-02, RNF-03): o campo filtra, e a lista logo
 * abaixo dele é o que se toca. Com duzentas espécies, achar no `select` do
 * celular é girar uma roda; aqui se digita "ipe" e sobram três linhas.
 *
 * **O que vai para o formulário é o `input` escondido**, nunca o texto digitado:
 * o servidor recebe sempre um id da lista, e texto que não virou escolha chega
 * como vazio, que é o caso que a validação já recusa.
 */
export function ComboboxField({
  label,
  name,
  options,
  value,
  onChange,
  placeholder = 'Digite para procurar…',
  hint,
  error,
  compacto = false,
  required = false,
  onCriarNova,
  rotuloCriar = (texto) => `+ Cadastrar "${texto}"`,
  opcaoFixa,
}: ComboboxFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const avisoId = `${id}-aviso`;

  const escolhida = options.find((opcao) => opcao.value === value);
  const [busca, setBusca] = useState(escolhida?.label ?? '');
  const [aberta, setAberta] = useState(false);
  // Escolha vinda de fora (o cliente recém-criado no modal) precisa aparecer no campo
  const [valorVisto, setValorVisto] = useState(value);
  if (value !== valorVisto) {
    setValorVisto(value);
    setBusca(options.find((opcao) => opcao.value === value)?.label ?? '');
  }

  const encontradas = filtraOpcoes(options, busca);
  const visiveis = encontradas.slice(0, MAX_VISIVEL);
  const escondidas = encontradas.length - visiveis.length;
  const digitouSemEscolher = busca.trim() !== '' && !escolhida;
  // Nome idêntico ao de uma opção é escolha, não cadastro: seria a mesma de novo
  const podeCriar =
    onCriarNova !== undefined &&
    busca.trim() !== '' &&
    !options.some((opcao) => normalizeTexto(opcao.label) === normalizeTexto(busca.trim()));

  // Texto digitado sem tocar na lista enche o campo visível, mas não é escolha:
  // para o navegador barrar o envio, o campo precisa se declarar inválido
  const campoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    campoRef.current?.setCustomValidity(required && digitouSemEscolher ? 'Toque num nome da lista para escolher.' : '');
  }, [required, digitouSemEscolher]);

  function escolher(opcao: SelectOption) {
    setValorVisto(opcao.value);
    setBusca(opcao.label);
    setAberta(false);
    onChange(opcao.value);
  }

  function digitar(texto: string) {
    setBusca(texto);
    setAberta(true);
    // Texto digitado não é escolha: enquanto não tocarem na lista, o campo vai vazio
    if (value) {
      setValorVisto('');
      onChange('');
    }
  }

  return (
    <div
      className={compacto ? 'relative' : 'flex flex-col gap-1'}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setAberta(false);
      }}
    >
      <label htmlFor={id} className={compacto ? 'sr-only' : 'text-sm font-semibold text-gray-700'}>
        {label}
      </label>
      {name && <input type="hidden" name={name} value={value} />}
      <input
        ref={campoRef}
        id={id}
        type="text"
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        value={busca}
        onChange={(event) => digitar(event.target.value)}
        onFocus={() => setAberta(true)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId, digitouSemEscolher ? avisoId : null].filter(Boolean).join(' ') || undefined}
        className={
          compacto
            ? // Célula de planilha: sem moldura de formulário, a grade da tabela é
              // a borda. O texto digitado que ainda não virou escolha fica em
              // âmbar, porque na célula não cabe a frase de aviso
              `h-11 w-full bg-transparent px-3 text-base placeholder:text-gray-400 focus:bg-white focus:outline-2 focus:-outline-offset-2 focus:outline-brand ${
                digitouSemEscolher ? 'text-amber-800' : 'text-ink'
              }`
            : 'min-h-touch w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink placeholder:text-gray-400 focus:border-brand-dark focus:outline-none aria-invalid:border-red-600'
        }
      />
      {/* O científico da espécie escolhida, miúdo embaixo do nome popular */}
      {escolhida?.detalhe && busca === escolhida.label && (
        <p className={`text-xs text-muted italic ${compacto ? '-mt-2 px-3 pb-1' : ''}`}>{escolhida.detalhe}</p>
      )}

      {aberta && (
        <ul
          className={`flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-lg border-[1.5px] border-gray-300 bg-white ${
            compacto ? 'absolute top-full left-0 z-30 w-max max-w-sm min-w-full shadow-lg' : ''
          }`}
        >
          {opcaoFixa && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setAberta(false);
                  opcaoFixa.onEscolher();
                }}
                className="min-h-touch w-full px-3 py-2 text-left text-base font-bold text-blue-800 active:bg-brand-light"
              >
                {opcaoFixa.rotulo}
              </button>
            </li>
          )}
          {visiveis.length === 0 ? (
            <li className="px-3 py-3 text-base text-muted">Nada encontrado com esse texto.</li>
          ) : (
            visiveis.map((opcao) => (
              <li key={opcao.value}>
                <button
                  type="button"
                  onClick={() => escolher(opcao)}
                  aria-current={opcao.value === value ? true : undefined}
                  className="min-h-touch w-full px-3 py-2 text-left text-base text-ink active:bg-brand-light aria-[current]:font-bold"
                >
                  {opcao.label}
                  {opcao.detalhe && <span className="block text-sm font-normal text-muted italic">{opcao.detalhe}</span>}
                </button>
              </li>
            ))
          )}
          {escondidas > 0 && (
            <li className="px-3 py-2 text-sm text-muted">
              e mais {escondidas}: digite um pedaço do nome para achar
            </li>
          )}
          {podeCriar && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setAberta(false);
                  onCriarNova?.(busca.trim());
                }}
                className="min-h-touch w-full px-3 py-2 text-left text-base font-bold text-brand active:bg-brand-light"
              >
                {rotuloCriar(busca.trim())}
              </button>
            </li>
          )}
        </ul>
      )}

      {digitouSemEscolher && !aberta && !compacto && (
        <p id={avisoId} className="text-sm font-semibold text-amber-800">
          Toque num nome da lista para escolher.
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
