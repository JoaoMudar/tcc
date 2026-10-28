'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { type ReconferenciaState, reconferirEspeciesAction } from './actions';

/** RF-13: o botão da reconferência, com o resultado logo abaixo. */
export function Reconferir() {
  const [state, reconferir, pendente] = useActionState(reconferirEspeciesAction, {} as ReconferenciaState);
  return (
    <form action={reconferir} className="flex flex-col gap-3">
      <Button type="submit" pending={pendente} pendingLabel="Reconferindo…">
        Reconferir as espécies
      </Button>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      {state.pendentes && state.pendentes.length > 0 && (
        <ul className="list-disc pl-6 text-base text-ink">
          {state.pendentes.map((nome) => (
            <li key={nome}>{nome}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
