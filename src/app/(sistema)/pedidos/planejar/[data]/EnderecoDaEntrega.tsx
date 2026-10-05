'use client';

import { useActionState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { CampoEndereco } from '@/components/ui/CampoEndereco';
import { CampoLocalizacao } from '@/components/ui/CampoLocalizacao';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { buscarEnderecosAction, salvarEnderecoEntregaAction } from './actions';

interface EnderecoDaEntregaProps {
  data: string;
  viagemId: string;
  cliente: { id: string; nome: string };
  /** O endereço que o cadastro já tem, quando o mapa não o achou. */
  endereco: string | null;
  onFechar: () => void;
}

/**
 * P17: o endereço de entrega que falta, sem sair da rota. Digita-se o
 * endereço, com as sugestões do mapa, ou cola-se a localização que o cliente
 * mandou pelo WhatsApp. Grava no cadastro do cliente, e vale para as próximas.
 */
export function EnderecoDaEntrega({ data, viagemId, cliente, endereco, onFechar }: EnderecoDaEntregaProps) {
  const [estado, salvar, salvando] = useActionState(salvarEnderecoEntregaAction, EMPTY_FORM_STATE);

  useEffect(() => {
    if (estado.success) onFechar();
  }, [estado.success, onFechar]);

  return (
    <Modal titulo={`Endereço de entrega · ${cliente.nome}`} onFechar={onFechar}>
      <form action={salvar} className="flex flex-col gap-3">
        <input type="hidden" name="data" value={data} />
        <input type="hidden" name="viagem_id" value={viagemId} />
        <input type="hidden" name="cliente_id" value={cliente.id} />
        <CampoEndereco
          label="Endereço"
          name="endereco"
          defaultValue={estado.fields?.endereco ?? endereco ?? ''}
          buscar={buscarEnderecosAction}
        />
        <CampoLocalizacao name="localizacao" defaultValue={estado.fields?.localizacao} />
        <p className="text-sm text-muted">Fica no cadastro do cliente e vale para as próximas entregas.</p>
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
