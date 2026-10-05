import 'server-only';
import { UserError } from './errors';
import { type OrigemFrete, ORIGENS_FRETE, sugerirFrete } from './frete';
import { parametrosDoFrete } from './parametros';
import { NEGOCIAVEIS } from './pedidos';
import { type EnderecoDeEntrega, salvarEnderecoDeEntrega } from './pessoas';
import { SITUACOES_PEDIDO, type SituacaoPedido } from './pedidos-rotulos';
import { enderecoEmTexto } from './rotas';
import { type Coordenada, MapaIndisponivel, distanciaDeCarro, geocodificarTexto } from './rotas-ors';
import type { Db } from './sql';
import { partidasBase } from './viagens';

export type SugestaoDeFrete =
  | { centavos: number; distanciaKm: number }
  | { aviso: 'saida_nao_achada' | 'mapa_indisponivel' }
  /** Falta o endereço de entrega, ou o mapa não o achou: a tela oferece completá-lo. */
  | { aviso: 'sem_endereco' | 'endereco_nao_achado'; endereco: string | null };

export const AVISOS_DO_FRETE: Record<Extract<SugestaoDeFrete, { aviso: string }>['aviso'], string> = {
  sem_endereco: 'Cliente sem endereço de entrega.',
  endereco_nao_achado: 'Endereço de entrega não achado no mapa.',
  saida_nao_achada: 'O endereço de saída não foi achado no mapa. Confira em Configurações.',
  mapa_indisponivel: 'O mapa não respondeu agora. Digite o frete combinado ou tente de novo.',
};

interface DestinoDoPedido {
  situacao: SituacaoPedido;
  numero: number;
  enderecoId: string | null;
  logradouro: string | null;
  cidade: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
  geocodificadoEm: Date | null;
}

/**
 * RN-64: a sugestão de frete do pedido, saindo de Agrolândia ou de Itapema
 * até o endereço de entrega do cliente, de carro, ida e volta.
 *
 * Como em `sugerirRota`, a coordenada achada para o endereço fica guardada nele,
 * e o mesmo texto não gasta outra consulta. **A rede fica fora de transação**:
 * a sugestão só lê, e a única escrita é a coordenada e a distância.
 */
export async function sugestaoDeFrete(db: Db, pedidoId: string, origem: OrigemFrete): Promise<SugestaoDeFrete> {
  const { rows } = await db.query<DestinoDoPedido>(
    `SELECT p.situacao, p.numero_pedido AS numero, e.id AS "enderecoId", e.logradouro, e.cidade, e.uf,
            e.lat::float8 AS lat, e.lng::float8 AS lng, e.geocodificado_em AS "geocodificadoEm"
       FROM pedidos p
       LEFT JOIN LATERAL (
         SELECT x.id, x.logradouro, x.cidade, x.uf, x.lat, x.lng, x.geocodificado_em
           FROM cadastro.pessoas_enderecos x
          WHERE x.pessoa_id = p.cliente_id AND x.tipo = 'entrega'
          ORDER BY x.criado_em, x.id
          LIMIT 1) e ON true
      WHERE p.id = $1`,
    [pedidoId],
  );
  const pedido = rows[0];
  if (!pedido) throw new UserError('Pedido não encontrado.');
  exigirNegociavel(pedido);

  const texto = enderecoEmTexto({ logradouro: pedido.logradouro, cidade: pedido.cidade, uf: pedido.uf });
  if (!pedido.enderecoId || !texto) return { aviso: 'sem_endereco', endereco: texto || null };

  try {
    let destino: Coordenada | null = pedido.lat !== null && pedido.lng !== null ? { lat: pedido.lat, lng: pedido.lng } : null;
    if (!destino) {
      // Já procurado e não achado: não gasta outra consulta com o mesmo texto
      if (pedido.geocodificadoEm) return { aviso: 'endereco_nao_achado', endereco: texto };
      destino = await geocodificarTexto(texto);
      await db.query('UPDATE cadastro.pessoas_enderecos SET lat = $2, lng = $3, geocodificado_em = NOW() WHERE id = $1', [
        pedido.enderecoId,
        destino?.lat ?? null,
        destino?.lng ?? null,
      ]);
      if (!destino) return { aviso: 'endereco_nao_achado', endereco: texto };
    }

    const partidas = await partidasBase(db);
    const saida = await geocodificarTexto(partidas[origem] || `${ORIGENS_FRETE[origem]}, SC`);
    if (!saida) return { aviso: 'saida_nao_achada' };

    const metros = await distanciaDeCarro(saida, destino);
    const distanciaKm = Math.max(0.1, Math.round(metros / 100) / 10);
    const { kmPorLitro, precoLitro } = await parametrosDoFrete(db);
    await db.query('UPDATE pedidos SET frete_distancia_km = $2, frete_origem = $3 WHERE id = $1', [
      pedidoId,
      distanciaKm,
      origem,
    ]);
    return { centavos: sugerirFrete(distanciaKm, kmPorLitro, precoLitro), distanciaKm };
  } catch (error) {
    if (error instanceof MapaIndisponivel) return { aviso: 'mapa_indisponivel' };
    throw error;
  }
}

function exigirNegociavel(pedido: { situacao: SituacaoPedido; numero: number }) {
  if (!NEGOCIAVEIS.includes(pedido.situacao)) {
    throw new UserError(
      `O pedido ${pedido.numero} está em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}, ` +
        'e o frete se combina depois da conferência.',
    );
  }
}

/**
 * P17: o endereço de entrega que faltou para sugerir o frete, completado na
 * ficha do pedido. Grava no cadastro do cliente do pedido, e só enquanto o
 * frete se negocia: a permissão de negociar não é a de editar cadastro.
 */
export async function salvarEnderecoDoPedido(db: Db, pedidoId: string, endereco: EnderecoDeEntrega): Promise<void> {
  const { rows } = await db.query<{ clienteId: string; situacao: SituacaoPedido; numero: number }>(
    'SELECT cliente_id AS "clienteId", situacao, numero_pedido AS numero FROM pedidos WHERE id = $1 FOR UPDATE',
    [pedidoId],
  );
  const pedido = rows[0];
  if (!pedido) throw new UserError('Pedido não encontrado.');
  exigirNegociavel(pedido);
  await salvarEnderecoDeEntrega(db, pedido.clienteId, endereco);
}
