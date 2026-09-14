import type { PoolClient } from 'pg';
import { hojeNoViveiro } from './datas';
import { UserError } from './errors';
import { type CausaPerda, type TipoMovimento, formatQuantidade, isCausaPerda } from './lotes-rotulos';

export { CAUSAS_PERDA, TIPOS_MOVIMENTO, formatQuantidade, isCausaPerda, type CausaPerda, type TipoMovimento } from './lotes-rotulos';

/**
 * A PORTA ÚNICA do saldo do lote (T4.1, RF-33, RF-36). Perda, repicagem, venda,
 * ajuste e transferência passam por `registrarMovimento`, e nada mais escreve em
 * `movimentos_lote` nem em `lotes.quantidade_atual`. Quem chama abre a transação
 * (`withTransaction`): a trava de linha só vale dentro dela.
 */

type Client = Pick<PoolClient, 'query'>;

/** Sinal que cada tipo admite: entrada soma, saída subtrai, o ajuste vai para os dois lados. */
export function sinalValido(tipo: Exclude<TipoMovimento, 'transferencia'>, quantidade: number): boolean {
  if (!Number.isSafeInteger(quantidade) || quantidade === 0) return false;
  switch (tipo) {
    case 'entrada':
    case 'repicagem_entrada':
      return quantidade > 0;
    case 'perda':
    case 'repicagem_saida':
    case 'venda':
      return quantidade < 0;
    case 'ajuste_contagem':
      return true;
  }
}

export interface LoteTravado {
  id: string;
  codigo: string;
  especieId: string;
  recipienteId: string;
  canteiroId: string | null;
  quantidadeAtual: number;
  encerrado: boolean;
}

/** `SELECT ... FOR UPDATE`: dois movimentos no mesmo lote esperam um pelo outro. */
export async function travarLote(client: Client, loteId: string): Promise<LoteTravado | null> {
  const { rows } = await client.query<LoteTravado>(
    `SELECT id, codigo, especie_id AS "especieId", recipiente_id AS "recipienteId", canteiro_id AS "canteiroId",
            quantidade_atual AS "quantidadeAtual", encerrado_em IS NOT NULL AS encerrado
       FROM lotes
      WHERE id = $1
      FOR UPDATE`,
    [loteId],
  );
  return rows[0] ?? null;
}

/**
 * Trava o canteiro e devolve a posição do fim da fila, a próxima depois dos lotes
 * abertos nele. `null` quando o canteiro não existe. A trava impede dois lotes de
 * entrarem no mesmo canteiro com a mesma posição.
 */
export async function proximaPosicao(client: Client, canteiroId: string): Promise<number | null> {
  const { rows } = await client.query<{ id: string }>('SELECT id FROM canteiros WHERE id = $1 FOR UPDATE', [canteiroId]);
  if (rows.length === 0) return null;
  const { rows: fim } = await client.query<{ posicao: number }>(
    'SELECT COALESCE(MAX(posicao), 0) + 1 AS posicao FROM lotes WHERE canteiro_id = $1 AND encerrado_em IS NULL',
    [canteiroId],
  );
  return fim[0].posicao;
}

interface MovimentoComum {
  loteId: string;
  registradoPor: string;
  /** `AAAA-MM-DD`; hoje no viveiro quando omitida. */
  data?: string;
  observacoes?: string | null;
  atribuicaoId?: string | null;
}

export type MovimentoInput = MovimentoComum &
  (
    | { tipo: 'transferencia'; canteiroDestinoId: string }
    | { tipo: 'perda'; quantidade: number; causa: CausaPerda }
    | { tipo: Exclude<TipoMovimento, 'transferencia' | 'perda'>; quantidade: number }
  );

export interface ResultadoMovimento {
  saldo: number;
  /** O saldo chegou a zero e o lote foi encerrado, liberando o canteiro (RN-22). */
  encerrado: boolean;
}

export async function registrarMovimento(client: Client, input: MovimentoInput): Promise<ResultadoMovimento> {
  const lote = await travarLote(client, input.loteId);
  if (!lote) throw new UserError('Lote não encontrado.');
  if (lote.encerrado) throw new UserError(`O lote ${lote.codigo} está encerrado e não recebe movimento.`);

  const data = input.data ?? hojeNoViveiro();
  const observacoes = input.observacoes ?? null;
  const atribuicaoId = input.atribuicaoId ?? null;

  if (input.tipo === 'transferencia') {
    if (input.canteiroDestinoId === lote.canteiroId) throw new UserError(`O lote ${lote.codigo} já está nesse canteiro.`);
    const posicao = await proximaPosicao(client, input.canteiroDestinoId);
    if (posicao === null) throw new UserError('Canteiro de destino não encontrado.');
    await client.query(
      `INSERT INTO movimentos_lote
         (lote_id, tipo_movimento, quantidade, data_movimento, canteiro_origem_id, canteiro_destino_id,
          atribuicao_id, registrado_por, observacoes)
       VALUES ($1, 'transferencia', 0, $2, $3, $4, $5, $6, $7)`,
      [lote.id, data, lote.canteiroId, input.canteiroDestinoId, atribuicaoId, input.registradoPor, observacoes],
    );
    await client.query('UPDATE lotes SET canteiro_id = $2, posicao = $3 WHERE id = $1', [
      lote.id,
      input.canteiroDestinoId,
      posicao,
    ]);
    return { saldo: lote.quantidadeAtual, encerrado: false };
  }

  if (!sinalValido(input.tipo, input.quantidade)) throw new UserError('Quantidade inválida para este movimento.');
  if (input.tipo === 'perda' && !isCausaPerda(input.causa)) throw new UserError('Escolha a causa da perda.');

  // RN-21: baixa maior que o saldo é contagem errada, e o negativo propagaria o erro
  const saldo = lote.quantidadeAtual + input.quantidade;
  if (saldo < 0) {
    throw new UserError(
      `O lote ${lote.codigo} tem ${formatQuantidade(lote.quantidadeAtual)} mudas. ` +
        `Não dá para baixar ${formatQuantidade(-input.quantidade)}: se o saldo está errado, registre uma contagem.`,
    );
  }

  await client.query(
    `INSERT INTO movimentos_lote
       (lote_id, tipo_movimento, quantidade, data_movimento, causa_perda, atribuicao_id, registrado_por, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      lote.id,
      input.tipo,
      input.quantidade,
      data,
      input.tipo === 'perda' ? input.causa : null,
      atribuicaoId,
      input.registradoPor,
      observacoes,
    ],
  );

  if (saldo === 0) {
    // RN-22: zerado, o lote sai do canteiro e continua consultável pelo histórico
    await client.query(
      `UPDATE lotes
          SET quantidade_atual = 0, fase = 'encerrado', encerrado_em = NOW(),
              motivo_encerramento = 'saldo_zero', canteiro_id = NULL, posicao = NULL
        WHERE id = $1`,
      [lote.id],
    );
    return { saldo, encerrado: true };
  }

  await client.query('UPDATE lotes SET quantidade_atual = $2 WHERE id = $1', [lote.id, saldo]);
  return { saldo, encerrado: false };
}
