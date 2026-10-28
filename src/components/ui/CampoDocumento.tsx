'use client';

import { useState } from 'react';
import { type TipoPessoa, validateDocumento } from '@/lib/documento';
import { TextField } from './TextField';

interface CampoDocumentoProps {
  tipo: TipoPessoa;
  defaultValue?: string;
}

/**
 * RF-21: CPF ou CNPJ conferido ao sair do campo, como o telefone. Com o erro na
 * tela, cada tecla confere de novo, para o aviso sumir assim que o número fica
 * certo, e não só quando o campo perde o foco outra vez.
 *
 * Quem troca entre pessoa física e jurídica remonta o campo (`key` no tipo), e
 * o aviso do tipo anterior não sobra.
 */
export function CampoDocumento({ tipo, defaultValue }: CampoDocumentoProps) {
  const [erro, setErro] = useState<string | null>(null);

  function conferir(texto: string) {
    const lido = validateDocumento(tipo, texto);
    setErro('error' in lido ? lido.error : null);
  }

  return (
    <TextField
      label={tipo === 'pf' ? 'CPF' : 'CNPJ'}
      name="documento"
      inputMode="numeric"
      defaultValue={defaultValue}
      error={erro ?? undefined}
      onChange={(event) => {
        if (erro) conferir(event.currentTarget.value);
      }}
      onBlur={(event) => conferir(event.currentTarget.value)}
    />
  );
}
