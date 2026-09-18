'use client';

import { useState } from 'react';
import { SelectField } from '@/components/ui/SelectField';
import { NENHUM } from '@/lib/agenda-rotulos';

export interface AreaOpcao {
  id: string;
  letra: string;
  canteiros: readonly { id: string; numero: number }[];
}

interface AreaCanteiroOpcionalProps {
  areas: readonly AreaOpcao[];
  defaultAreaId?: string | null;
  defaultCanteiroId?: string | null;
}

/** RF-30: onde foi feita a tarefa que não exige lote. Opcional, e o canteiro só depois da área. */
export function AreaCanteiroOpcional({ areas, defaultAreaId, defaultCanteiroId }: AreaCanteiroOpcionalProps) {
  const inicialArea = defaultAreaId || NENHUM;
  const [areaId, setAreaId] = useState(inicialArea);
  const canteiros = areas.find((area) => area.id === areaId)?.canteiros ?? [];

  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField
        label="Área (opcional)"
        name="area_id"
        options={[{ value: NENHUM, label: 'Nenhuma' }, ...areas.map((area) => ({ value: area.id, label: `Área ${area.letra}` }))]}
        defaultValue={inicialArea}
        onChange={(event) => setAreaId(event.target.value)}
      />
      <SelectField
        key={areaId}
        label="Canteiro (opcional)"
        name="canteiro_id"
        options={[{ value: NENHUM, label: 'A área toda' }, ...canteiros.map((c) => ({ value: c.id, label: String(c.numero) }))]}
        defaultValue={areaId === inicialArea && defaultCanteiroId ? defaultCanteiroId : NENHUM}
        disabled={canteiros.length === 0}
      />
    </div>
  );
}
