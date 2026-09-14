'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ClienteRapido } from '@/components/ClienteRapido';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import type { PessoaRef } from '@/lib/pessoas-form';

/** Na lista de pessoas o cadastro rápido abre por cima; na Fase 8 o pedido usa o mesmo componente. */
export function ClienteRapidoButton() {
  const [aberto, setAberto] = useState(false);
  const [criado, setCriado] = useState<PessoaRef | null>(null);

  return (
    <>
      {criado && (
        <Notice tone="success">
          {criado.nome} está no cadastro.{' '}
          <Link href={`/cadastros/pessoas/${criado.id}`} className="font-bold underline">
            Completar cadastro
          </Link>
        </Notice>
      )}
      <Button
        variant="outline"
        onClick={() => {
          setCriado(null);
          setAberto(true);
        }}
      >
        + Cliente rápido
      </Button>
      {aberto && (
        <ClienteRapido
          onFechar={() => setAberto(false)}
          onCriado={(cliente) => {
            setCriado(cliente);
            setAberto(false);
          }}
        />
      )}
    </>
  );
}
