'use client';

import { useId, useState } from 'react';
import { filtraOpcoes } from '@/lib/busca-opcoes';
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
      className={`flex flex-col gap-1 ${compacto ? 'relative' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setAberta(false);
      }}
    >
      <label htmlFor={id} className={compacto ? 'sr-only' : 'text-sm font-semibold text-gray-700'}>
        {label}
      </label>
      {name && <input type="hidden" name={name} value={value} />}
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={busca}
        onChange={(event) => digitar(event.target.value)}
        onFocus={() => setAberta(true)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId, digitouSemEscolher ? avisoId : null].filter(Boolean).join(' ') || undefined}
        className={`min-h-touch w-full rounded-lg border-[1.5px] bg-white px-3 text-base text-ink placeholder:text-gray-400 focus:border-brand-dark focus:outline-none aria-invalid:border-red-600 ${
          // Na célula não cabe a frase de aviso, então a borda é que avisa que
          // o texto digitado ainda não virou escolha
          compacto && digitouSemEscolher ? 'border-amber-600' : 'border-gray-300'
        }`}
      />

      {aberta && (
        <ul
          className={`flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-lg border-[1.5px] border-gray-300 bg-white ${
            compacto ? 'absolute top-full right-0 left-0 z-20 shadow-lg' : ''
          }`}
        >
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
                </button>
              </li>
            ))
          )}
          {escondidas > 0 && (
            <li className="px-3 py-2 text-sm text-muted">
              e mais {escondidas}: digite um pedaço do nome para achar
            </li>
          )}
        </ul>
      )}

      {escolhida && !aberta && !compacto && <p className="text-sm text-muted">Escolhido: {escolhida.label}</p>}
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
