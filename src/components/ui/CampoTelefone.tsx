'use client';

import { useState } from 'react';
import { formatTelefone, validateTelefone } from '@/lib/documento';
import { TextField } from './TextField';

interface CampoTelefoneProps {
  defaultValue?: string;
  hint?: string;
  required?: boolean;
}

/**
 * Telefone conferido enquanto se digita: a saída do campo mostra o erro e, se o
 * número está certo, o põe na máscara. Com o erro na tela, cada tecla confere de
 * novo, para o aviso sumir assim que o número fica certo, e não só no salvar.
 */
export function CampoTelefone({ defaultValue, hint, required }: CampoTelefoneProps) {
  const [erro, setErro] = useState<string | null>(null);

  function conferir(valor: string): string | null {
    const lido = validateTelefone(valor);
    const mensagem = 'error' in lido ? lido.error : null;
    setErro(mensagem);
    return 'value' in lido ? lido.value : null;
  }

  return (
    <TextField
      label="Telefone"
      name="telefone"
      type="tel"
      inputMode="tel"
      defaultValue={defaultValue}
      hint={hint}
      required={required}
      error={erro ?? undefined}
      onChange={(event) => {
        if (erro) conferir(event.currentTarget.value);
      }}
      onBlur={(event) => {
        const campo = event.currentTarget;
        const digitos = conferir(campo.value);
        if (digitos) campo.value = formatTelefone(digitos);
      }}
    />
  );
}
