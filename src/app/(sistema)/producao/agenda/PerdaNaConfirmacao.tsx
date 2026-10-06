'use client';

import { useState } from 'react';
import { TextField } from '@/components/ui/TextField';
import { lerQuantidade } from '@/lib/lotes-rotulos';
import { CausaPicker } from '../lotes/CausaPicker';

interface PerdaNaConfirmacaoProps {
  /** O que voltou do servidor depois de um erro, para não se perder o digitado. */
  perdidas?: string;
  causa?: string;
}

/** UC-20: as mudas que morreram, no mesmo gesto da confirmação, para a perda não ser esquecida. */
export function PerdaNaConfirmacao({ perdidas: inicial, causa }: PerdaNaConfirmacaoProps) {
  const [perdidas, setPerdidas] = useState(lerQuantidade(inicial ?? '') ?? 0);
  return (
    <details open={perdidas > 0} className="rounded-xl border border-line">
      <summary className="flex min-h-touch cursor-pointer list-none items-center px-4 text-base font-semibold text-ink">
        Morreu alguma?
      </summary>
      <div className="flex flex-col gap-4 border-t border-line p-4">
        <TextField
          label="Quantas morreram"
          name="perdidas"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={inicial}
          onChange={(event) => setPerdidas(lerQuantidade(event.target.value) ?? 0)}
        />
        {perdidas > 0 && <CausaPicker defaultValue={causa} />}
      </div>
    </details>
  );
}
