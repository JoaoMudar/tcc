'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { type CanteiroResumo, avisoCapacidade } from '@/lib/lotes-rotulos';

interface CanteiroPickerProps {
  canteiros: readonly CanteiroResumo[];
  /** Mudas que vão entrar, para o aviso de capacidade. */
  quantidade: number | null;
  defaultAreaId?: string;
  defaultCanteiroId?: string;
  /** O canteiro em que o lote já está, fora da lista na transferência. */
  excluirCanteiroId?: string | null;
  sufixo?: string;
}

/** Área e canteiro, com a lotação de cada um à vista e o aviso que não impede (RN-28). */
export function CanteiroPicker({
  canteiros,
  quantidade,
  defaultAreaId = '',
  defaultCanteiroId = '',
  excluirCanteiroId = null,
  sufixo = '',
}: CanteiroPickerProps) {
  const [areaId, setAreaId] = useState(defaultAreaId);
  const [canteiroId, setCanteiroId] = useState(defaultCanteiroId);

  const areas = [...new Map(canteiros.map((c) => [c.areaId, { value: c.areaId, label: `Área ${c.letra}` }])).values()];
  const daArea = canteiros.filter((c) => c.areaId === areaId && c.id !== excluirCanteiroId);
  const escolhido = daArea.find((c) => c.id === canteiroId);
  const aviso = escolhido && quantidade ? avisoCapacidade(escolhido, quantidade) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={`Área${sufixo}`}
          name="area_id"
          options={areas}
          defaultValue={defaultAreaId}
          onChange={(event) => {
            setAreaId(event.target.value);
            setCanteiroId('');
          }}
          required
        />
        <SelectField
          key={areaId}
          label={`Canteiro${sufixo}`}
          name="canteiro_id"
          options={daArea.map((c) => ({
            value: c.id,
            label: c.lotes === 0 ? `${c.numero} · livre` : `${c.numero} · ${c.lotes} ${c.lotes === 1 ? 'lote' : 'lotes'}`,
          }))}
          defaultValue={areaId === defaultAreaId ? defaultCanteiroId : ''}
          onChange={(event) => setCanteiroId(event.target.value)}
          disabled={!areaId}
          required
        />
      </div>
      {aviso && <Notice tone="warning">{aviso}</Notice>}
    </>
  );
}
