import 'server-only';
import { UserError } from './errors';
import { type OrigemFrete, ORIGENS_FRETE, sugerirFrete } from './frete';
import { parametrosDoFrete } from './parametros';
import { NEGOCIAVEIS } from './pedidos';
import { SITUACOES_PEDIDO, type SituacaoPedido } from './pedidos-rotulos';
import { enderecoEmTexto } from './rotas';
import { type Coordenada, MapaIndisponivel, distanciaDeCarro, geocodificarTexto } from './rotas-ors';
import type { Db } from './sql';
import { partidasBase } from './viagens';

export type SugestaoDeFrete =
  | { centavos: number; distanciaKm: number }
  | { aviso: 'sem_endereco' | 'endereco_nao_achado' | 'saida_nao_achada' | 'mapa_indisponivel' };

export const AVISOS_DO_FRETE: Record<Extract<SugestaoDeFrete, { aviso: string }>['aviso'], string> = {
  sem_endereco: 'O cliente não tem endereço de entrega. Digite o frete combinado.',
  endereco_nao_achado: 'O endereço de entrega do cliente não foi achado no mapa. Digite o frete combinado.',
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
  if (!NEGOCIAVEIS.includes(pedido.situacao)) {
    throw new UserError(
      `O pedido ${pedido.numero} está em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}, ` +
        'e o frete se combina depois da conferência.',
    );
  }

  const texto = enderecoEmTexto({ logradouro: pedido.logradouro, cidade: pedido.cidade, uf: pedido.uf });
  if (!pedido.enderecoId || !texto) return { aviso: 'sem_endereco' };

  try {
    let destino: Coordenada | null = pedido.lat !== null && pedido.lng !== null ? { lat: pedido.lat, lng: pedido.lng } : null;
    if (!destino) {
      // Já procurado e não achado: não gasta outra consulta com o mesmo texto
      if (pedido.geocodificadoEm) return { aviso: 'endereco_nao_achado' };
      destino = await geocodificarTexto(texto);
      await db.query('UPDATE cadastro.pessoas_enderecos SET lat = $2, lng = $3, geocodificado_em = NOW() WHERE id = $1', [
        pedido.enderecoId,
        destino?.lat ?? null,
        destino?.lng ?? null,
      ]);
      if (!destino) return { aviso: 'endereco_nao_achado' };
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
