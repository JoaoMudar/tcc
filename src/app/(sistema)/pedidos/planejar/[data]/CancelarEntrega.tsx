'use client';

import { useActionState } from 'react';
import { ConfirmacaoDupla } from '@/components/ui/ConfirmacaoDupla';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { cancelarEntregaAction } from './actions';

interface CancelarEntregaProps {
  data: string;
  viagemId: string;
}

/** Cancelar a entrega desfaz a viagem inteira, e por isso pede dois toques. Fica no fim da tela. */
export function CancelarEntrega({ data, viagemId }: CancelarEntregaProps) {
  const [resultado, cancelar, cancelando] = useActionState(cancelarEntregaAction, EMPTY_FORM_STATE);
  return (
    <div className="px-4 pb-6">
      <ConfirmacaoDupla
        tom="danger"
        rotuloBotao="Cancelar entrega"
        titulo="Cancelar a entrega?"
        rotuloConfirmar="Sim, cancelar a entrega"
        rotuloVoltar="Não, voltar à entrega"
        action={cancelar}
        pendente={cancelando}
        erro={resultado.error}
      >
        <input type="hidden" name="data" value={data} />
        <input type="hidden" name="viagem_id" value={viagemId} />
      </ConfirmacaoDupla>
    </div>
  );
}
