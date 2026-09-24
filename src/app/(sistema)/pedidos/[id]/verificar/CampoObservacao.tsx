'use client';

import { useState } from 'react';
import { TextField } from '@/components/ui/TextField';

interface CampoObservacaoProps {
  valor: string;
  onChange: (valor: string) => void;
  onBlur?: () => void;
}

/**
 * P12: a observação fica recolhida. Quase nenhum item precisa dela, e um campo
 * aberto em cada cartão dobra o tamanho da lista no celular. Já escrita, ela
 * aparece aberta, porque esconder o que alguém anotou é perder a anotação.
 */
export function CampoObservacao({ valor, onChange, onBlur }: CampoObservacaoProps) {
  const [aberto, setAberto] = useState(valor.trim() !== '');

  if (!aberto) {
    return (
      <button
        type="button"
        className="min-h-touch self-start text-base font-semibold text-brand-dark underline-offset-2 active:underline"
        onClick={() => setAberto(true)}
      >
        Adicionar observação
      </button>
    );
  }

  return (
    <TextField
      label="Observação"
      name="observacoes"
      maxLength={500}
      value={valor}
      onChange={(evento) => onChange(evento.target.value)}
      onBlur={onBlur}
      hint="Vai junto com a resposta do item."
    />
  );
}
