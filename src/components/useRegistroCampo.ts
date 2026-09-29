'use client';

import { useRouter } from 'next/navigation';
import { useActionState } from 'react';
import type { TipoEnvio } from '@/lib/envios';
import { enviarGuardado } from '@/lib/fila-envio';
import { enfileirar, remover } from '@/lib/fila-local';
import type { FormState } from '@/lib/form-state';

export interface EstadoRegistro extends FormState {
  /** Ficou no aparelho, sem chegar ao servidor: o texto que a pessoa lê na hora (TA-23). */
  guardado?: string;
  /** Muda a cada registro concluído, gravado ou guardado: é a `key` que limpa o formulário. */
  rodada?: string;
}

export const GUARDADO_SEM_REDE = 'Guardado no aparelho. Vai sozinho quando a rede voltar.';

interface Opcoes {
  /** O que o indicador da fila mostra enquanto o registro espera: "Perda de 30 no lote 2026-0012". */
  rotulo: (campos: Record<string, string>) => string;
  /** Frase a mais no aviso de guardado, quando o formulário tem algo a dizer sobre esperar. */
  complementoGuardado?: (campos: Record<string, string>) => string | undefined;
}

function camposDe(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const [nome, valor] of formData.entries()) if (typeof valor === 'string') campos[nome] = valor;
  return campos;
}

/**
 * O formulário de campo que funciona sem rede (T9.3, RNF-05). O registro entra
 * na fila **antes** de qualquer tentativa de envio, para sobreviver a recarregar
 * a página no meio (TA-59), e só então vai ao servidor. Com rede, a pessoa vê a
 * resposta do servidor como antes; sem rede, vê na hora que ficou guardado.
 */
export function useRegistroCampo(tipo: TipoEnvio, { rotulo, complementoGuardado }: Opcoes) {
  const router = useRouter();

  return useActionState<EstadoRegistro, FormData>(async (_anterior, formData) => {
    const campos = camposDe(formData);
    const chave = crypto.randomUUID();
    let naFila = true;
    try {
      await enfileirar({ chave, tipo, campos, rotulo: rotulo(campos) });
    } catch {
      // Navegador sem IndexedDB (aba privada em alguns celulares): segue sem a fila, e sem rede avisa
      naFila = false;
    }

    const desfecho = await enviarGuardado({ chave, tipo, campos }, { recusadoSai: true });
    switch (desfecho.tipo) {
      case 'gravado':
        if (desfecho.destino) router.push(desfecho.destino);
        else router.refresh();
        return { success: desfecho.success, rodada: chave };
      case 'recusado':
        return { error: desfecho.error, fields: desfecho.fields ?? campos };
      case 'sem_sessao':
        if (!naFila) return { error: desfecho.error, fields: campos };
        return { guardado: `Guardado no aparelho. ${desfecho.error}`, rodada: chave };
      case 'sem_rede': {
        if (!naFila) {
          await remover(chave).catch(() => undefined);
          return { error: 'Sem conexão, e este navegador não guarda o registro. Tente de novo com rede.', fields: campos };
        }
        const extra = complementoGuardado?.(campos);
        return { guardado: extra ? `${GUARDADO_SEM_REDE} ${extra}` : GUARDADO_SEM_REDE, rodada: chave };
      }
    }
  }, {});
}
