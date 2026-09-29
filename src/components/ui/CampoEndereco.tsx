'use client';

import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import type { SugestaoDeEndereco } from '@/lib/rotas';
import { classeRotulo } from './marcaObrigatorio';

/** Espera a pessoa parar de digitar antes de perguntar ao mapa. */
const ESPERA_MS = 300;
const MINIMO = 3;

interface CampoEnderecoProps {
  label: string;
  /** O texto vai com este nome; a coordenada da escolha, em `lat` e `lng`. */
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  /** Quem procura: a Server Action, para a chave do mapa ficar no servidor. */
  buscar: (texto: string) => Promise<SugestaoDeEndereco[]>;
}

/**
 * Endereço com sugestões enquanto se digita, como no Google Maps: tocar numa
 * linha escreve o endereço completo e guarda a coordenada dele, e o lugar fica
 * exato. **O texto livre continua valendo**: sem escolher, ou com o mapa fora do
 * ar, o endereço digitado é procurado depois, como antes.
 */
export function CampoEndereco({ label, name, defaultValue = '', required = false, className = '', buscar }: CampoEnderecoProps) {
  const id = useId();
  const listaId = `${id}-lista`;
  const [texto, setTexto] = useState(defaultValue);
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestaoDeEndereco[]>([]);
  const [aberta, setAberta] = useState(false);
  const [ativa, setAtiva] = useState(-1);
  const pedido = useRef(0);

  useEffect(() => {
    const busca = texto.trim();
    // Escolhido da lista, ou curto demais: não há o que procurar
    if (ponto || busca.length < MINIMO) return;
    const numero = ++pedido.current;
    const espera = setTimeout(async () => {
      let achadas: SugestaoDeEndereco[] = [];
      try {
        achadas = await buscar(busca);
      } catch {
        // Sem lista, o campo segue como texto livre
      }
      // Resposta de uma busca que já foi superada pela digitação chega tarde e fica fora
      if (numero !== pedido.current) return;
      setSugestoes(achadas);
      setAtiva(-1);
    }, ESPERA_MS);
    return () => clearTimeout(espera);
  }, [texto, ponto, buscar]);

  function digitar(valor: string) {
    setTexto(valor);
    setPonto(null);
    setAberta(true);
    if (valor.trim().length < MINIMO) setSugestoes([]);
  }

  function escolher(sugestao: SugestaoDeEndereco) {
    pedido.current++;
    setTexto(sugestao.rotulo);
    setPonto({ lat: sugestao.lat, lng: sugestao.lng });
    setSugestoes([]);
    setAberta(false);
  }

  function teclar(evento: KeyboardEvent<HTMLInputElement>) {
    if (!aberta || sugestoes.length === 0) return;
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setAtiva((atual) => (atual + 1) % sugestoes.length);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setAtiva((atual) => (atual <= 0 ? sugestoes.length - 1 : atual - 1));
    } else if (evento.key === 'Enter' && ativa >= 0) {
      // Enter na lista escolhe; sem linha marcada, envia o formulário como sempre
      evento.preventDefault();
      escolher(sugestoes[ativa]);
    } else if (evento.key === 'Escape') {
      setAberta(false);
    }
  }

  const mostraLista = aberta && sugestoes.length > 0;

  return (
    <div
      className={`flex flex-col gap-1 ${className}`}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setAberta(false);
      }}
    >
      <label htmlFor={id} className={classeRotulo(required)}>
        {label}
      </label>
      <input type="hidden" name="lat" value={ponto?.lat ?? ''} />
      <input type="hidden" name="lng" value={ponto?.lng ?? ''} />
      <div className="relative">
        <input
          id={id}
          name={name}
          type="text"
          required={required}
          autoComplete="off"
          placeholder="Digite o endereço ou o lugar…"
          value={texto}
          onChange={(evento) => digitar(evento.target.value)}
          onFocus={() => setAberta(true)}
          onKeyDown={teclar}
          role="combobox"
          aria-expanded={mostraLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={mostraLista && ativa >= 0 ? `${listaId}-${ativa}` : undefined}
          className="min-h-touch w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-3 text-base text-ink placeholder:text-gray-400 focus:border-brand-dark focus:outline-none"
        />
        {mostraLista && (
          <ul
            id={listaId}
            role="listbox"
            className="absolute top-full left-0 z-30 mt-1 flex max-h-72 w-full flex-col divide-y divide-line overflow-y-auto rounded-lg border-[1.5px] border-gray-300 bg-white shadow-lg"
          >
            {sugestoes.map((sugestao, indice) => (
              <li key={`${sugestao.rotulo}-${indice}`} id={`${listaId}-${indice}`} role="option" aria-selected={indice === ativa}>
                <button
                  type="button"
                  tabIndex={-1}
                  // Sem isto o campo perde o foco no toque, e a lista fecha antes do clique
                  onMouseDown={(evento) => evento.preventDefault()}
                  onClick={() => escolher(sugestao)}
                  className={`min-h-touch w-full px-3 py-2 text-left text-base text-ink active:bg-brand-light ${indice === ativa ? 'bg-brand-light' : ''}`}
                >
                  {sugestao.rotulo}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
