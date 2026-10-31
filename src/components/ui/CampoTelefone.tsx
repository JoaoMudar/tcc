'use client';

import { useState } from 'react';
import { useCursorDaMascara } from '@/components/useCursorDaMascara';
import { cursorPelaEsquerda } from '@/lib/cursor-mascara';
import { mascaraTelefone, telefoneCompleto, validateTelefone } from '@/lib/documento';
import { TextField } from './TextField';

interface CampoTelefoneProps {
  defaultValue?: string;
  hint?: string;
  required?: boolean;
}

/**
 * Telefone na máscara enquanto se digita, e conferido assim que tem todos os
 * dígitos ou ao sair do campo. Com o erro na tela, cada tecla confere de novo,
 * para o aviso sumir assim que o número fica certo, e não só no salvar. O
 * cursor fica onde estava, para corrigir o DDD sem redigitar o número.
 */
export function CampoTelefone({ defaultValue, hint, required }: CampoTelefoneProps) {
  const [valor, setValor] = useState(() => mascaraTelefone(defaultValue ?? ''));
  const [erro, setErro] = useState<string | null>(null);
  const manterCursor = useCursorDaMascara();

  function conferir(texto: string) {
    const lido = validateTelefone(texto);
    setErro('error' in lido ? lido.error : null);
  }

  return (
    <TextField
      label="Telefone"
      name="telefone"
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder="(47) 99612-4408"
      value={valor}
      hint={hint}
      required={required}
      error={erro ?? undefined}
      onChange={(event) => {
        const campo = event.currentTarget;
        manterCursor(campo, cursorPelaEsquerda(campo));
        const novo = mascaraTelefone(campo.value, valor);
        setValor(novo);
        if (erro || telefoneCompleto(novo)) conferir(novo);
      }}
      onBlur={() => conferir(valor)}
    />
  );
}
