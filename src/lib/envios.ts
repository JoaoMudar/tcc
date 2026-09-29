import type { PoolClient } from 'pg';
import { UserError } from './errors';

/**
 * A chave de idempotência do registro feito sem conexão (RNF-05, UC-20 FA-3).
 * O aparelho gera a chave antes de tentar enviar e a manda em toda tentativa;
 * a primeira grava, as outras recebem a mesma resposta sem executar de novo.
 */

type Client = Pick<PoolClient, 'query'>;

export const TIPOS_ENVIO = ['perda', 'contagem', 'confirmacao_tarefa'] as const;
export type TipoEnvio = (typeof TIPOS_ENVIO)[number];

export function isTipoEnvio(valor: unknown): valor is TipoEnvio {
  return typeof valor === 'string' && (TIPOS_ENVIO as readonly string[]).includes(valor);
}

export interface Envio {
  chave: string;
  tipo: TipoEnvio;
  usuarioId: string;
}

/**
 * Executa `registrar` uma vez por chave. Tem de rodar dentro da transação do
 * registro: a chave e o registro gravam juntos, ou nenhum dos dois. Se
 * `registrar` recusa, a transação desfaz a chave também, e o reenvio encontra
 * a mesma recusa em vez de um "já recebido" que não gravou nada.
 *
 * Duas tentativas simultâneas com a mesma chave: o `INSERT` da segunda espera a
 * primeira terminar, e então encontra a chave gravada.
 */
export async function executarUmaVez<T>(
  client: Client,
  envio: Envio,
  registrar: () => Promise<T>,
): Promise<{ resposta: T; repetido: boolean }> {
  const { rows: nova } = await client.query(
    `INSERT INTO envios_recebidos (chave, tipo, usuario_id, resposta)
     VALUES ($1, $2, $3, 'null'::jsonb)
     ON CONFLICT (chave) DO NOTHING
     RETURNING chave`,
    [envio.chave, envio.tipo, envio.usuarioId],
  );

  if (nova.length === 0) {
    const { rows } = await client.query<{ tipo: string; usuarioId: string; resposta: T }>(
      'SELECT tipo, usuario_id AS "usuarioId", resposta FROM envios_recebidos WHERE chave = $1',
      [envio.chave],
    );
    const anterior = rows[0];
    // Chave repetida com outro dono ou outro tipo não é reenvio: é engano ou forja
    if (!anterior || anterior.usuarioId !== envio.usuarioId || anterior.tipo !== envio.tipo) {
      throw new UserError('Este registro não confere com o que foi recebido antes. Descarte e registre de novo.');
    }
    return { resposta: anterior.resposta, repetido: true };
  }

  const resposta = await registrar();
  await client.query('UPDATE envios_recebidos SET resposta = $2 WHERE chave = $1', [envio.chave, JSON.stringify(resposta)]);
  return { resposta, repetido: false };
}
