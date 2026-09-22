'use client';

import { useActionState, useEffect, useRef } from 'react';
import { criarEspecieRapidaAction } from '@/app/(sistema)/cadastros/especies/acoes-rapidas';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_ESPECIE_RAPIDA_STATE, type EspecieRef } from '@/lib/especies-form';

interface EspecieRapidaProps {
  /** Nome popular já digitado, que vem preenchido da linha colada. */
  nomeSugerido?: string;
  /** Chamado uma vez, com a espécie criada ou reaproveitada. */
  onCriada: (especie: EspecieRef) => void;
  onFechar: () => void;
}

/**
 * T8.16 (RF-10): espécie nova numa folha por cima da tela, no meio do cadastro
 * de um pedido.
 *
 * **O nome científico é pedido, e não deduzido**: é ele que identifica a espécie
 * no catálogo, e é único no banco. Quem não o souber na hora fecha esta folha e
 * usa o item genérico, que deixa a escolha para a conferência.
 */
export function EspecieRapida({ nomeSugerido = '', onCriada, onFechar }: EspecieRapidaProps) {
  const [state, formAction, pending] = useActionState(criarEspecieRapidaAction, EMPTY_ESPECIE_RAPIDA_STATE);
  const avisado = useRef<string | null>(null);

  useEffect(() => {
    if (state.especie && avisado.current !== state.especie.id) {
      avisado.current = state.especie.id;
      onCriada(state.especie);
    }
  }, [state.especie, onCriada]);

  return (
    <Modal titulo="Espécie nova" onFechar={onFechar}>
      <form action={formAction} className="flex flex-col gap-3">
        <TextField
          label="Nome popular"
          name="nome_popular"
          autoComplete="off"
          defaultValue={state.fields?.nome_popular ?? nomeSugerido}
          required
          autoFocus
        />
        <TextField
          label="Nome científico"
          name="nome_cientifico"
          autoComplete="off"
          placeholder="Cedrela fissilis"
          defaultValue={state.fields?.nome_cientifico}
          hint="É ele que identifica a espécie no catálogo"
          required
        />
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.existente && <Notice tone="info">{state.existente.nome} já estava cadastrada, e foi escolhida.</Notice>}
        <Notice tone="info">Foto, características e protocolo podem ser completados depois, no cadastro.</Notice>
        <Button type="submit" pending={pending}>
          Salvar e voltar
        </Button>
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
      </form>
    </Modal>
  );
}
