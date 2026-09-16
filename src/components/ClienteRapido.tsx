'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createClienteRapido } from '@/app/(sistema)/cadastros/pessoas/actions';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_CLIENTE_RAPIDO_STATE, type PessoaRef } from '@/lib/pessoas-form';

interface ClienteRapidoProps {
  /** Chamado uma vez, com o cliente criado ou reaproveitado. */
  onCriado: (cliente: PessoaRef) => void;
  onFechar: () => void;
}

/**
 * F1 UC-10 (RF-15): nome e telefone numa folha por cima da tela, sem sair
 * dela. O cliente novo quase sempre aparece no meio de uma conversa.
 */
export function ClienteRapido({ onCriado, onFechar }: ClienteRapidoProps) {
  const [state, formAction, pending] = useActionState(createClienteRapido, EMPTY_CLIENTE_RAPIDO_STATE);
  const avisado = useRef<string | null>(null);

  useEffect(() => {
    if (state.cliente && avisado.current !== state.cliente.id) {
      avisado.current = state.cliente.id;
      onCriado(state.cliente);
    }
  }, [state.cliente, onCriado]);

  return (
    <Modal titulo="Cliente novo" onFechar={onFechar}>
      <form action={formAction} className="flex flex-col gap-3">
          <TextField label="Nome" name="nome" defaultValue={state.fields?.nome} autoComplete="off" required autoFocus />
          <TextField
            label="Telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            defaultValue={state.fields?.telefone}
            hint="Com DDD"
            required
          />
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.candidatas ? (
            <>
              <Notice tone="warning">Já existe cadastro com esse telefone. É a mesma pessoa?</Notice>
              {state.candidatas.map((candidata) => (
                <Button key={candidata.id} type="submit" name="usar_pessoa_id" value={candidata.id} pending={pending}>
                  Sim, usar {candidata.nome}
                </Button>
              ))}
              <Button type="submit" name="confirmar_novo" value="1" variant="outline" pending={pending}>
                Não, criar cliente novo
              </Button>
            </>
          ) : (
            <>
              <Notice tone="info">Os dados fiscais podem ser completados depois, se o pedido exigir nota.</Notice>
              <Button type="submit" pending={pending}>
                Salvar e voltar
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
      </form>
    </Modal>
  );
}
