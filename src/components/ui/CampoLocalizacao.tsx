'use client';

import { useState } from 'react';
import { lerLocalizacao, linkCurto, linkDoPonto, pontoEmTexto } from '@/lib/localizacao';
import { TextField } from './TextField';

interface CampoLocalizacaoProps {
  name: string;
  label?: string;
  defaultValue?: string;
}

/**
 * P17: onde se cola a localização que o cliente mandou pelo WhatsApp. Diz, à
 * medida que se cola, se o ponto foi lido, e deixa conferir no mapa antes de
 * salvar. O link curto (`maps.app.goo.gl`) só o servidor abre: a tela avisa que
 * ele é lido ao salvar.
 */
export function CampoLocalizacao({ name, label = 'Localização do WhatsApp', defaultValue = '' }: CampoLocalizacaoProps) {
  const [texto, setTexto] = useState(defaultValue);
  const ponto = lerLocalizacao(texto);
  const curto = !ponto && linkCurto(texto) !== null;
  const ilegivel = texto.trim() !== '' && !ponto && !curto;

  return (
    <div className="flex flex-col gap-1">
      <TextField
        label={label}
        name={name}
        autoComplete="off"
        placeholder="Cole aqui o link ou os números"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        hint={texto.trim() === '' ? 'No WhatsApp: toque na localização, depois em compartilhar, e copie.' : undefined}
        error={ilegivel ? 'Não deu para ler o ponto. Cole o link que o cliente mandou, ou os dois números.' : undefined}
      />
      {ponto && (
        <p className="text-sm text-green-800">
          Ponto lido: {pontoEmTexto(ponto)} ·{' '}
          <a href={linkDoPonto(ponto)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            ver no mapa
          </a>
        </p>
      )}
      {curto && <p className="text-sm text-muted">Link curto do Google Maps: o ponto é lido ao salvar.</p>}
    </div>
  );
}
