'use client';

import { useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { CampoEndereco } from '@/components/ui/CampoEndereco';
import { CampoLocalizacao } from '@/components/ui/CampoLocalizacao';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE, type FormState } from '@/lib/form-state';
import type { SugestaoDeEndereco } from '@/lib/rotas';

interface EnderecoDaEntregaProps {
  nomeCliente: string;
  /** O texto com que o campo abre. A ficha do pedido o abre vazio; a rota, com o que o mapa não achou. */
  endereco: string | null;
  /** Quem grava: a rota do planejar ou o frete do pedido, cada um com a sua permissão. */
  acao: (previous: FormState, formData: FormData) => Promise<FormState>;
  buscar: (texto: string) => Promise<SugestaoDeEndereco[]>;
  /** O que identifica a viagem ou o pedido, em campos escondidos. */
  camposOcultos: Record<string, string>;
  onFechar: () => void;
  /** Depois de gravar; sem ele, só fecha. */
  onSalvo?: () => void;
}

/**
 * P17, P19: o destino do pedido, sem sair da tela. Digita-se o endereço, com
 * as sugestões do mapa, ou cola-se a localização que o cliente mandou pelo
 * WhatsApp. Grava no pedido: o cadastro do cliente não muda.
 */
export function EnderecoDaEntrega({
  nomeCliente,
  endereco,
  acao,
  buscar,
  camposOcultos,
  onFechar,
  onSalvo,
}: EnderecoDaEntregaProps) {
  const [estado, salvar, salvando] = useActionState(acao, EMPTY_FORM_STATE);
  const depois = onSalvo ?? onFechar;

  useEffect(() => {
    if (estado.success) depois();
  }, [estado.success, depois]);

  return (
    <Modal titulo={`Endereço de entrega · ${nomeCliente}`} onFechar={onFechar}>
      <form action={salvar} className="flex flex-col gap-3">
        {Object.entries(camposOcultos).map(([nome, valor]) => (
          <input key={nome} type="hidden" name={nome} value={valor} />
        ))}
        <CampoEndereco
          label="Endereço"
          name="endereco"
          defaultValue={estado.fields?.endereco ?? endereco ?? ''}
          buscar={buscar}
        />
        <CampoLocalizacao name="localizacao" defaultValue={estado.fields?.localizacao} />
        <p className="text-sm text-muted">Vale só para este pedido. O cadastro do cliente não muda.</p>
        {estado.error && <Notice tone="error">{estado.error}</Notice>}
        <Button type="submit" pending={salvando}>
          Salvar endereço
        </Button>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </form>
    </Modal>
  );
}
