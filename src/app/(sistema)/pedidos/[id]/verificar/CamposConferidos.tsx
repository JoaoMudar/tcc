'use client';

import { type SelectOption, SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { type Pergunta, formatAltura, normalizaCampoAltura } from '@/lib/pedidos-rotulos';

export interface Campos {
  quantidade: string;
  recipienteId: string;
  altura: string;
}

interface CamposConferidosProps {
  perguntas: readonly Pergunta[];
  valores: Campos;
  recipientes: readonly SelectOption[];
  /** O que o cliente pediu, para a dica embaixo do campo. */
  pedido: { quantidade: number | null; alturaM: number | null };
  /** "complemento_" na segunda linha do "+", para os nomes não colidirem. */
  prefixo?: string;
  /** `gravar` é o fim da edição do campo: sair dele, ou escolher na lista. */
  onAlterar: (campo: keyof Campos, valor: string, gravar?: boolean) => void;
}

/**
 * P12, P13: quantas, em que recipiente e com que altura, na ordem da regra
 * (`perguntasDoItem`). A mesma peça serve à linha da resposta e ao complemento.
 */
export function CamposConferidos({
  perguntas,
  valores,
  recipientes,
  pedido,
  prefixo = '',
  onAlterar,
}: CamposConferidosProps) {
  return perguntas.map((pergunta) => {
    if (pergunta.campo === 'quantidade') {
      return (
        <TextField
          key="quantidade"
          label="Quantas tem"
          name={`${prefixo}quantidade`}
          inputMode="numeric"
          autoComplete="off"
          required={pergunta.obrigatorio}
          hint={pedido.quantidade === null ? undefined : `Pedido: ${formatQuantidade(pedido.quantidade)}`}
          value={valores.quantidade}
          onChange={(evento) => onAlterar('quantidade', evento.target.value)}
          onBlur={() => onAlterar('quantidade', valores.quantidade, true)}
        />
      );
    }
    if (pergunta.campo === 'recipiente') {
      return (
        // Pode ser outro recipiente: achou em saco o que foi pedido em tubete
        <SelectField
          key="recipiente"
          label="Em que recipiente está"
          name={`${prefixo}recipiente_id`}
          required={pergunta.obrigatorio}
          options={recipientes}
          value={valores.recipienteId}
          onChange={(evento) => onAlterar('recipienteId', evento.target.value, true)}
        />
      );
    }
    return (
      <TextField
        key="altura"
        label="Com que altura"
        name={`${prefixo}altura`}
        inputMode="decimal"
        autoComplete="off"
        required={pergunta.obrigatorio}
        hint={pedido.alturaM === null ? undefined : `Pedido: ${formatAltura(pedido.alturaM)}`}
        value={valores.altura}
        onChange={(evento) => onAlterar('altura', evento.target.value)}
        onBlur={() => {
          const normalizada = normalizaCampoAltura(valores.altura);
          onAlterar('altura', normalizada === '' ? '' : normalizada.replace(/\s*m$/, ''), true);
        }}
      />
    );
  });
}
