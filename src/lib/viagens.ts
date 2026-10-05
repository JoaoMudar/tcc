import type { PoolClient } from 'pg';
import { type ItemDaCarga, concluirCarga, criarCargaUnica, listCargas } from './cargas';
import { formatData } from './datas';
import { UserError } from './errors';
import { nomeEspecieSql } from './lotes';
import { PARTIDA_AGROLANDIA, PARTIDA_ITAPEMA } from './parametros';
import { type AutorDaMudanca, travarPedido } from './pedidos';
import { SITUACOES_PEDIDO, type SituacaoPedido } from './pedidos-rotulos';
import { type AvisoDaRota, type SituacaoViagem, aplicarOrdemSugerida, enderecoEmTexto } from './rotas';
import { type Coordenada, MapaIndisponivel, geocodificarTexto, otimizarOrdem } from './rotas-ors';
import type { Db } from './sql';
import { withTransaction } from './transaction';

export { atualizarSituacaoViagem } from './cargas';

/**
 * P14: a viagem de entrega. Junta os pedidos (de aprovado para cima) que saem no mesmo
 * caminhão, guarda a ordem das paradas e a etapa em que o planejamento parou.
 *
 * **Toda ação grava na hora.** Não há botão "Salvar": pôr e tirar pedido, a
 * partida, a ordem e cada item separado já estão no banco quando a tela volta,
 * e é isso que deixa a pessoa sair e continuar depois.
 */

type Client = Pick<PoolClient, 'query'>;
type Conectavel = Db & { connect(): Promise<PoolClient> };

export interface Viagem {
  id: string;
  data: string;
  partidaDescricao: string;
  partidaLat: number | null;
  partidaLng: number | null;
  situacao: SituacaoViagem;
  sugerirOrdem: boolean;
  distanciaM: number | null;
  duracaoS: number | null;
}

export interface ItemResumido {
  especie: string;
  quantidade: number | null;
  alturaM: number | null;
}

export interface ParadaDaViagem {
  id: string;
  ordem: number;
  pedidoId: string | null;
  numero: number | null;
  cliente: string | null;
  /** O cliente da entrega: é nele que o endereço que falta se completa (P17). */
  clienteId: string | null;
  cidade: string | null;
  logradouro: string | null;
  /** O endereço de entrega em uma linha; na parada avulsa, o que foi digitado. */
  endereco: string | null;
  descricao: string | null;
  lat: number | null;
  lng: number | null;
  /** A API procurou o endereço de entrega e não achou. */
  naoAchado: boolean;
  /** O endereço de entrega do cadastro, onde a coordenada fica guardada. */
  enderecoId: string | null;
  itens: ItemResumido[];
}

export interface PedidoParaViagem {
  id: string;
  numero: number;
  cliente: string;
  cidade: string | null;
  logradouro: string | null;
  dataEntrega: string | null;
  situacao: SituacaoPedido;
  itens: ItemResumido[];
}

/**
 * O pedido entra na viagem **de aprovado para cima**: o aprovado ganha a carga
 * no carregamento, e o que já está separando ou pronto leva as cargas que já tem.
 */
export const SITUACOES_DA_VIAGEM: readonly SituacaoPedido[] = ['aprovado', 'separando', 'pronto_envio'];

const COLUNAS_VIAGEM = `v.id, to_char(v.data, 'YYYY-MM-DD') AS data, v.partida_descricao AS "partidaDescricao",
       v.partida_lat::float8 AS "partidaLat", v.partida_lng::float8 AS "partidaLng", v.situacao,
       v.sugerir_ordem AS "sugerirOrdem", v.distancia_m AS "distanciaM", v.duracao_s AS "duracaoS"`;

/** O primeiro endereço de entrega do cliente: o pedido não tem endereço próprio. */
const ENDERECO_DE_ENTREGA = `LEFT JOIN LATERAL (
         SELECT x.id, x.logradouro, x.cidade, x.uf, x.lat, x.lng, x.geocodificado_em
           FROM cadastro.pessoas_enderecos x
          WHERE x.pessoa_id = c.id AND x.tipo = 'entrega'
          ORDER BY x.criado_em, x.id
          LIMIT 1) e ON true`;

/**
 * A viagem do dia: a que ainda não ficou pronta, e sem ela a última pronta. Com
 * `nova`, só a que está em andamento: a pessoa pediu outra viagem no mesmo dia.
 */
export async function viagemDoDia(db: Db, data: string, { nova = false } = {}): Promise<Viagem | null> {
  const { rows } = await db.query<Viagem>(
    `SELECT ${COLUNAS_VIAGEM}
       FROM viagens v
      WHERE v.data = $1 AND ($2 = false OR v.situacao <> 'pronta')
      ORDER BY (v.situacao = 'pronta'), v.criado_em DESC
      LIMIT 1`,
    [data, nova],
  );
  return rows[0] ?? null;
}

export async function findViagem(db: Db, viagemId: string): Promise<Viagem | null> {
  const { rows } = await db.query<Viagem>(`SELECT ${COLUNAS_VIAGEM} FROM viagens v WHERE v.id = $1`, [viagemId]);
  return rows[0] ?? null;
}

/** As viagens que alguém começou e não terminou: o ponto e o "Continuar" do calendário. */
export async function viagensEmAndamento(db: Db): Promise<{ id: string; data: string; situacao: SituacaoViagem }[]> {
  const { rows } = await db.query<{ id: string; data: string; situacao: SituacaoViagem }>(
    `SELECT id, to_char(data, 'YYYY-MM-DD') AS data, situacao
       FROM viagens
      WHERE situacao <> 'pronta'
      ORDER BY data, criado_em`,
  );
  return rows;
}

async function itensDosPedidos(db: Db, pedidoIds: readonly string[]): Promise<Map<string, ItemResumido[]>> {
  const porPedido = new Map<string, ItemResumido[]>();
  if (pedidoIds.length === 0) return porPedido;
  // Item real, como na carga: o pai genérico não vai no caminhão, os filhos dele vão
  const { rows } = await db.query<ItemResumido & { pedidoId: string }>(
    `SELECT i.pedido_id AS "pedidoId", COALESCE(${nomeEspecieSql('e')}, 'Espécie não definida') AS especie,
            i.quantidade, i.altura_m::float8 AS "alturaM"
       FROM pedidos_itens i
       LEFT JOIN especies e ON e.id = i.especie_id
      WHERE i.pedido_id = ANY($1::uuid[]) AND i.generico = false
      ORDER BY especie, i.criado_em, i.id`,
    [pedidoIds],
  );
  for (const { pedidoId, ...item } of rows) porPedido.set(pedidoId, [...(porPedido.get(pedidoId) ?? []), item]);
  return porPedido;
}

type LinhaParada = Omit<ParadaDaViagem, 'itens' | 'endereco'> & {
  uf: string | null;
  enderecoAvulso: string | null;
};

async function linhasDasParadas(db: Db, viagemId: string): Promise<LinhaParada[]> {
  const { rows } = await db.query<LinhaParada>(
    `SELECT vp.id, vp.ordem, vp.pedido_id AS "pedidoId", p.numero_pedido AS numero, c.nome AS cliente,
            c.id AS "clienteId", vp.descricao, vp.endereco AS "enderecoAvulso",
            e.id AS "enderecoId", e.logradouro, e.cidade, e.uf,
            COALESCE(vp.lat, e.lat)::float8 AS lat, COALESCE(vp.lng, e.lng)::float8 AS lng,
            (e.geocodificado_em IS NOT NULL AND e.lat IS NULL) AS "naoAchado"
       FROM viagens_paradas vp
       LEFT JOIN pedidos p ON p.id = vp.pedido_id
       LEFT JOIN cadastro.pessoas c ON c.id = p.cliente_id
       ${ENDERECO_DE_ENTREGA}
      WHERE vp.viagem_id = $1
      ORDER BY vp.ordem`,
    [viagemId],
  );
  return rows;
}

/** As paradas na ordem da rota, com os itens de cada entrega. */
export async function listParadas(db: Db, viagemId: string): Promise<ParadaDaViagem[]> {
  const linhas = await linhasDasParadas(db, viagemId);
  const itens = await itensDosPedidos(
    db,
    linhas.flatMap((linha) => (linha.pedidoId ? [linha.pedidoId] : [])),
  );
  return linhas.map(({ uf, enderecoAvulso, ...linha }) => ({
    ...linha,
    endereco: linha.pedidoId ? enderecoEmTexto({ logradouro: linha.logradouro, cidade: linha.cidade, uf }) : enderecoAvulso,
    itens: linha.pedidoId ? (itens.get(linha.pedidoId) ?? []) : [],
  }));
}

/**
 * O que pode entrar numa viagem: pedido de aprovado para cima
 * (`SITUACOES_DA_VIAGEM`) que **nunca esteve em viagem nenhuma**. Como não há
 * situação "entregue", o pedido que já saiu num caminhão continua pronto para
 * envio, e sem esta regra a lista acumularia tudo o que já foi entregue.
 */
export async function pedidosDisponiveis(db: Db): Promise<PedidoParaViagem[]> {
  const { rows } = await db.query<Omit<PedidoParaViagem, 'itens'>>(
    `SELECT p.id, p.numero_pedido AS numero, c.nome AS cliente, e.cidade, e.logradouro,
            to_char(p.data_entrega, 'YYYY-MM-DD') AS "dataEntrega", p.situacao
       FROM pedidos p
       JOIN cadastro.pessoas c ON c.id = p.cliente_id
       ${ENDERECO_DE_ENTREGA}
      WHERE p.situacao = ANY($1::text[])
        AND NOT EXISTS (SELECT 1 FROM viagens_paradas vp WHERE vp.pedido_id = p.id)
      ORDER BY p.data_entrega NULLS LAST, p.numero_pedido`,
    [SITUACOES_DA_VIAGEM],
  );
  const itens = await itensDosPedidos(
    db,
    rows.map((pedido) => pedido.id),
  );
  return rows.map((pedido) => ({ ...pedido, itens: itens.get(pedido.id) ?? [] }));
}

async function travarViagem(client: Client, viagemId: string): Promise<Viagem> {
  const { rows } = await client.query<Viagem>(`SELECT ${COLUNAS_VIAGEM} FROM viagens v WHERE v.id = $1 FOR UPDATE`, [
    viagemId,
  ]);
  if (!rows[0]) throw new UserError('Viagem não encontrada.');
  return rows[0];
}

function exigirEtapa(viagem: Viagem, etapa: SituacaoViagem, mensagem: string): void {
  if (viagem.situacao !== etapa) throw new UserError(mensagem);
}

async function proximaOrdem(client: Client, viagemId: string): Promise<number> {
  const { rows } = await client.query<{ n: number }>(
    'SELECT COALESCE(MAX(ordem), 0)::int + 1 AS n FROM viagens_paradas WHERE viagem_id = $1',
    [viagemId],
  );
  return rows[0].n;
}

/** Ordem mudou sem a API: a distância e o tempo eram de outra ordem, e somem. */
async function esquecerRota(client: Client, viagemId: string, { sugerirDeNovo }: { sugerirDeNovo: boolean }) {
  await client.query(
    `UPDATE viagens SET distancia_m = NULL, duracao_s = NULL, sugerir_ordem = sugerir_ordem OR $2 WHERE id = $1`,
    [viagemId, sugerirDeNovo],
  );
}

async function partidaPadrao(client: Client): Promise<string> {
  const { rows } = await client.query<{ valor: string }>('SELECT valor FROM parametros WHERE chave = $1', [
    PARTIDA_AGROLANDIA,
  ]);
  if (!rows[0]) throw new Error(`Parâmetro ${PARTIDA_AGROLANDIA} ausente`);
  return rows[0].valor;
}

/** Os dois endereços-base da Tela 2, de Configurações. */
export async function partidasBase(db: Db): Promise<{ agrolandia: string; itapema: string }> {
  const { rows } = await db.query<{ chave: string; valor: string }>(
    'SELECT chave, valor FROM parametros WHERE chave = ANY($1::text[])',
    [[PARTIDA_AGROLANDIA, PARTIDA_ITAPEMA]],
  );
  const valor = (chave: string) => rows.find((row) => row.chave === chave)?.valor ?? '';
  return { agrolandia: valor(PARTIDA_AGROLANDIA), itapema: valor(PARTIDA_ITAPEMA) };
}

/**
 * Tela 1: põe o pedido na carga do dia, criando a viagem na primeira vez.
 *
 * **Grava a data de entrega na hora**, com linha no histórico: o pedido em
 * aberto que entra na viagem de 02/10 passa a ser entregue em 02/10, e a ficha
 * dele diz quando e por quê.
 */
export async function adicionarPedido(
  client: Client,
  data: string,
  pedidoId: string,
  autor: AutorDaMudanca,
): Promise<{ viagemId: string }> {
  // Duas pessoas pondo o primeiro pedido do dia ao mesmo tempo criariam duas viagens
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`viagem:${data}`]);

  const { rows: existente } = await client.query<{ id: string }>(
    "SELECT id FROM viagens WHERE data = $1 AND situacao <> 'pronta' ORDER BY criado_em DESC LIMIT 1",
    [data],
  );
  let viagemId = existente[0]?.id;
  if (viagemId) {
    const viagem = await travarViagem(client, viagemId);
    exigirEtapa(viagem, 'montando', 'A carga desta viagem já foi confirmada. Volte à etapa da carga para mudar.');
  } else {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO viagens (data, partida_descricao, criado_por) VALUES ($1, $2, $3) RETURNING id',
      [data, await partidaPadrao(client), autor.usuarioId],
    );
    viagemId = rows[0].id;
  }

  const pedido = await travarPedido(client, pedidoId);
  if (!SITUACOES_DA_VIAGEM.includes(pedido.situacao)) {
    throw new UserError(
      `O pedido ${pedido.numero} está em ${SITUACOES_PEDIDO[pedido.situacao].toLowerCase()}, e só pedido aprovado para cima entra na viagem.`,
    );
  }
  const { rows: impedimentos } = await client.query<{ viagens: number }>(
    'SELECT COUNT(*)::int AS viagens FROM viagens_paradas WHERE pedido_id = $1',
    [pedidoId],
  );
  if (impedimentos[0].viagens > 0) {
    throw new UserError(`O pedido ${pedido.numero} já está em outra viagem.`);
  }

  await client.query('INSERT INTO viagens_paradas (viagem_id, ordem, pedido_id) VALUES ($1, $2, $3)', [
    viagemId,
    await proximaOrdem(client, viagemId),
    pedidoId,
  ]);
  await esquecerRota(client, viagemId, { sugerirDeNovo: true });

  const { rowCount } = await client.query(
    'UPDATE pedidos SET data_entrega = $2 WHERE id = $1 AND data_entrega IS DISTINCT FROM $2::date',
    [pedidoId, data],
  );
  if (rowCount) {
    await client.query(
      `INSERT INTO pedidos_historico (pedido_id, situacao_anterior, situacao_nova, alterado_por, observacoes)
       VALUES ($1, $2, $2, $3, $4)`,
      [
        pedidoId,
        pedido.situacao,
        autor.usuarioId,
        `Entrega marcada para ${formatData(data).slice(0, 5)} no planejamento da viagem.`,
      ],
    );
  }
  return { viagemId };
}

/** Fecha o buraco que a parada tirada deixou. A unicidade da ordem é conferida no fim do comando. */
async function renumerar(client: Client, viagemId: string, depoisDe: number): Promise<void> {
  await client.query('UPDATE viagens_paradas SET ordem = ordem - 1 WHERE viagem_id = $1 AND ordem > $2', [
    viagemId,
    depoisDe,
  ]);
}

/**
 * Tela 1: tira o pedido da carga. A data de entrega fica como está: foi
 * combinada com o cliente, e tirar da viagem não a desfaz. A viagem que fica
 * sem pedido nenhum é apagada, e o calendário deixa de oferecer "Continuar".
 */
export async function tirarPedido(client: Client, viagemId: string, pedidoId: string): Promise<{ apagada: boolean }> {
  const viagem = await travarViagem(client, viagemId);
  exigirEtapa(viagem, 'montando', 'A carga desta viagem já foi confirmada. Volte à etapa da carga para mudar.');

  const { rows } = await client.query<{ ordem: number }>(
    'DELETE FROM viagens_paradas WHERE viagem_id = $1 AND pedido_id = $2 RETURNING ordem',
    [viagemId, pedidoId],
  );
  if (!rows[0]) throw new UserError('Este pedido não está nesta viagem.');
  await renumerar(client, viagemId, rows[0].ordem);

  const { rows: restantes } = await client.query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM viagens_paradas WHERE viagem_id = $1 AND pedido_id IS NOT NULL',
    [viagemId],
  );
  if (restantes[0].n === 0) {
    await client.query('DELETE FROM viagens WHERE id = $1', [viagemId]);
    return { apagada: true };
  }
  await esquecerRota(client, viagemId, { sugerirDeNovo: true });
  return { apagada: false };
}

/**
 * Tela 2: grava a ordem inteira, que é o que o arraste e as setas produzem.
 * Com `rota`, a ordem veio da sugestão, e a distância e o tempo dela ficam.
 *
 * **A lista tem de ser exatamente a das paradas da viagem.** A tela que ficou
 * aberta enquanto outra pessoa tirava um pedido mandaria uma ordem velha, e
 * gravá-la pela metade deixaria parada sem número.
 */
export async function salvarOrdem(
  client: Client,
  viagemId: string,
  paradaIds: readonly string[],
  rota: { distanciaM: number | null; duracaoS: number | null } | null = null,
): Promise<void> {
  const viagem = await travarViagem(client, viagemId);
  exigirEtapa(viagem, 'roteirizando', 'A ordem só muda na etapa da rota.');

  const { rows } = await client.query<{ id: string }>('SELECT id FROM viagens_paradas WHERE viagem_id = $1', [
    viagemId,
  ]);
  const atuais = new Set(rows.map((row) => row.id));
  if (paradaIds.length !== atuais.size || new Set(paradaIds).size !== atuais.size || paradaIds.some((id) => !atuais.has(id))) {
    throw new UserError('As paradas mudaram enquanto a tela estava aberta. Abra a rota de novo.');
  }

  await client.query('SET CONSTRAINTS viagens_paradas_ordem_unica DEFERRED');
  for (const [indice, id] of paradaIds.entries()) {
    await client.query('UPDATE viagens_paradas SET ordem = $2 WHERE id = $1', [id, indice + 1]);
  }
  await client.query(
    'UPDATE viagens SET sugerir_ordem = false, distancia_m = $2, duracao_s = $3 WHERE id = $1',
    [viagemId, rota?.distanciaM ?? null, rota?.duracaoS ?? null],
  );
}

/**
 * Tela 2: de onde o caminhão sai. A coordenada antiga era de outro endereço, e
 * some; a que veio junto com o endereço escolhido na lista entra no lugar dela.
 */
export async function definirPartida(
  client: Client,
  viagemId: string,
  descricao: string,
  coordenada: Coordenada | null = null,
): Promise<void> {
  const texto = descricao.trim();
  if (!texto) throw new UserError('Digite o endereço de saída.');
  const viagem = await travarViagem(client, viagemId);
  exigirEtapa(viagem, 'roteirizando', 'A saída só muda na etapa da rota.');
  if (texto === viagem.partidaDescricao && !coordenada) return;
  await client.query(
    `UPDATE viagens SET partida_descricao = $2, partida_lat = $3, partida_lng = $4,
                        distancia_m = NULL, duracao_s = NULL, sugerir_ordem = true
      WHERE id = $1`,
    [viagemId, texto, coordenada?.lat ?? null, coordenada?.lng ?? null],
  );
}

/**
 * Tela 2: parada que não é entrega ("abastecer"). Sem item, não aparece no
 * carregamento. A coordenada vem do endereço escolhido na lista, e sem endereço
 * não há o que situar.
 */
export async function adicionarParada(
  client: Client,
  viagemId: string,
  descricao: string,
  endereco: string | null,
  coordenada: Coordenada | null = null,
): Promise<void> {
  const texto = descricao.trim();
  if (!texto) throw new UserError('Descreva a parada.');
  const viagem = await travarViagem(client, viagemId);
  exigirEtapa(viagem, 'roteirizando', 'Parada extra só entra na etapa da rota.');
  const local = endereco?.trim() || null;
  const ponto = local ? coordenada : null;
  await client.query(
    'INSERT INTO viagens_paradas (viagem_id, ordem, descricao, endereco, lat, lng) VALUES ($1, $2, $3, $4, $5, $6)',
    [viagemId, await proximaOrdem(client, viagemId), texto, local, ponto?.lat ?? null, ponto?.lng ?? null],
  );
  await esquecerRota(client, viagemId, { sugerirDeNovo: false });
}

/** Tela 2: só a parada avulsa sai por aqui; o pedido sai na etapa da carga. */
export async function removerParada(client: Client, viagemId: string, paradaId: string): Promise<void> {
  const viagem = await travarViagem(client, viagemId);
  exigirEtapa(viagem, 'roteirizando', 'Parada extra só sai na etapa da rota.');
  const { rows } = await client.query<{ ordem: number }>(
    'DELETE FROM viagens_paradas WHERE id = $1 AND viagem_id = $2 AND pedido_id IS NULL RETURNING ordem',
    [paradaId, viagemId],
  );
  if (!rows[0]) throw new UserError('Parada não encontrada.');
  await renumerar(client, viagemId, rows[0].ordem);
  await esquecerRota(client, viagemId, { sugerirDeNovo: false });
}

/** O endereço de entrega como chega da Tela 2: o texto, e o ponto quando se sabe. */
export interface EnderecoDeEntrega {
  logradouro: string;
  /** Nulos mantêm o que o cadastro já tem. */
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  ponto: Coordenada | null;
}

/**
 * P17: o endereço de entrega que falta, completado na Tela 2 sem sair da
 * viagem. Grava no cadastro do cliente, que é onde o endereço mora (o pedido
 * não tem endereço próprio), e só de cliente com entrega nesta viagem: a
 * permissão de planejar não é a de editar cadastro qualquer.
 *
 * Com o ponto (escolhido na lista, ou a localização colada do WhatsApp), a
 * coordenada é gravada junto, e o mapa não precisa procurar o texto. Sem ele,
 * a coordenada que existia só cai se o texto mudou, e quem a procura de novo é
 * a sugestão de ordem, que a viagem passa a pedir.
 */
export async function salvarEnderecoDeEntrega(
  client: Client,
  viagemId: string,
  clienteId: string,
  endereco: EnderecoDeEntrega,
): Promise<void> {
  const viagem = await travarViagem(client, viagemId);
  exigirEtapa(viagem, 'roteirizando', 'O endereço se completa na etapa da rota.');
  const { rowCount } = await client.query(
    `SELECT 1 FROM viagens_paradas vp JOIN pedidos p ON p.id = vp.pedido_id
      WHERE vp.viagem_id = $1 AND p.cliente_id = $2`,
    [viagemId, clienteId],
  );
  if (!rowCount) throw new UserError('Este cliente não tem entrega nesta viagem.');

  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM cadastro.pessoas_enderecos
      WHERE pessoa_id = $1 AND tipo = 'entrega'
      ORDER BY criado_em, id LIMIT 1 FOR UPDATE`,
    [clienteId],
  );
  const { logradouro, cidade, uf, cep, ponto } = endereco;
  if (!rows[0]) {
    await client.query(
      `INSERT INTO cadastro.pessoas_enderecos (pessoa_id, tipo, logradouro, cidade, uf, cep, lat, lng, geocodificado_em)
       VALUES ($1, 'entrega', $2, $3, $4, $5, $6, $7, CASE WHEN $6::numeric IS NULL THEN NULL ELSE NOW() END)`,
      [clienteId, logradouro, cidade, uf, cep, ponto?.lat ?? null, ponto?.lng ?? null],
    );
  } else if (ponto) {
    await client.query(
      `UPDATE cadastro.pessoas_enderecos
          SET logradouro = $2, cidade = COALESCE($3, cidade), uf = COALESCE($4, uf), cep = COALESCE($5, cep),
              lat = $6, lng = $7, geocodificado_em = NOW()
        WHERE id = $1`,
      [rows[0].id, logradouro, cidade, uf, cep, ponto.lat, ponto.lng],
    );
  } else {
    // O texto mudou: o gatilho apaga a coordenada velha. O "não achado" também
    // cai, para a sugestão procurar o texto novo em vez de repetir o aviso
    await client.query(
      `UPDATE cadastro.pessoas_enderecos
          SET logradouro = $2, cidade = COALESCE($3, cidade), uf = COALESCE($4, uf), cep = COALESCE($5, cep),
              geocodificado_em = CASE WHEN lat IS NULL THEN NULL ELSE geocodificado_em END
        WHERE id = $1`,
      [rows[0].id, logradouro, cidade, uf, cep],
    );
  }
  await esquecerRota(client, viagemId, { sugerirDeNovo: true });
}

/** Tela 1 ↔ Tela 2: "Confirmar carga" e a seta de voltar. */
export async function mudarEtapa(
  client: Client,
  viagemId: string,
  para: 'montando' | 'roteirizando',
): Promise<Viagem> {
  const viagem = await travarViagem(client, viagemId);
  const de = para === 'roteirizando' ? 'montando' : 'roteirizando';
  exigirEtapa(viagem, de, 'A viagem já saiu desta etapa.');

  if (para === 'roteirizando') {
    const { rows } = await client.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM viagens_paradas WHERE viagem_id = $1 AND pedido_id IS NOT NULL',
      [viagemId],
    );
    if (rows[0].n === 0) throw new UserError('Ponha ao menos um pedido na carga.');
  }
  await client.query('UPDATE viagens SET situacao = $2 WHERE id = $1', [viagemId, para]);
  return { ...viagem, situacao: para };
}

const ORDEM_DAS_ETAPAS: Record<SituacaoViagem, number> = { montando: 0, roteirizando: 1, carregando: 2, pronta: 3 };

/**
 * P17: voltar uma ou duas etapas, pelo cabeçalho ou pela seta. **Do
 * carregamento também se volta**: as cargas e os itens já marcados ficam, e ao
 * avançar de novo `iniciarCarregamento` segue com elas, sem criar outras. Só a
 * viagem pronta não volta, porque a carga dela já foi dada como pronta.
 */
export async function voltarEtapa(client: Client, viagemId: string, para: 'montando' | 'roteirizando'): Promise<void> {
  const viagem = await travarViagem(client, viagemId);
  if (viagem.situacao === 'pronta') throw new UserError('A viagem já está pronta, e não volta de etapa.');
  if (ORDEM_DAS_ETAPAS[para] >= ORDEM_DAS_ETAPAS[viagem.situacao]) throw new UserError('A viagem já está nesta etapa.');
  await client.query('UPDATE viagens SET situacao = $2 WHERE id = $1', [viagemId, para]);
}

/**
 * Tela 2 → Tela 3: cria a carga de cada pedido aprovado, numa transação só. Cada
 * um passa a `separando` por `criarCargaUnica`, que é a mesma porta do "Organizar
 * cargas": o pedido que alguém mexeu no meio do caminho recusa a viagem inteira.
 *
 * O pedido que **já tem carga** (separando ou pronto para envio) segue com as
 * dele, todas: o item já separado chega marcado e travado na Tela 3.
 */
export async function iniciarCarregamento(client: Client, viagemId: string, autor: AutorDaMudanca): Promise<void> {
  const viagem = await travarViagem(client, viagemId);
  exigirEtapa(viagem, 'roteirizando', 'O carregamento começa na etapa da rota.');
  const { rows } = await client.query<{ pedidoId: string; numero: number; situacao: SituacaoPedido; temCarga: boolean }>(
    `SELECT vp.pedido_id AS "pedidoId", p.numero_pedido AS numero, p.situacao,
            EXISTS (SELECT 1 FROM pedidos_cargas c WHERE c.pedido_id = vp.pedido_id) AS "temCarga"
       FROM viagens_paradas vp
       JOIN pedidos p ON p.id = vp.pedido_id
      WHERE vp.viagem_id = $1 ORDER BY vp.ordem`,
    [viagemId],
  );
  if (rows.length === 0) throw new UserError('A viagem não tem pedido.');
  for (const { pedidoId, numero, situacao, temCarga } of rows) {
    if (!temCarga) {
      await criarCargaUnica(client, pedidoId, autor);
    } else if (!SITUACOES_DA_VIAGEM.includes(situacao)) {
      // A carga ficou, mas o pedido foi cancelado depois de entrar na viagem
      throw new UserError(`O pedido ${numero} está em ${SITUACOES_PEDIDO[situacao].toLowerCase()}, e não vai na viagem.`);
    }
  }
  await client.query("UPDATE viagens SET situacao = 'carregando' WHERE id = $1", [viagemId]);
}

export interface GrupoDoCarregamento {
  paradaId: string;
  pedidoId: string;
  numero: number;
  cliente: string;
  cidade: string | null;
  /** Posição na rota, entre as entregas: 1 é a primeira a ser entregue. */
  entrega: number;
  itens: (ItemDaCarga & { cargaId: string; cargaPronta: boolean })[];
}

/** Tela 3: as cargas da viagem, uma por entrega, na ordem da rota (a tela inverte). */
export async function cargasDaViagem(db: Db, viagemId: string): Promise<GrupoDoCarregamento[]> {
  const entregas = (await listParadas(db, viagemId)).filter((parada) => parada.pedidoId !== null);
  return Promise.all(
    entregas.map(async (parada, indice) => {
      const cargas = await listCargas(db, parada.pedidoId!);
      return {
        paradaId: parada.id,
        pedidoId: parada.pedidoId!,
        numero: parada.numero!,
        cliente: parada.cliente!,
        cidade: parada.cidade,
        entrega: indice + 1,
        itens: cargas.flatMap((carga) =>
          carga.itens.map((item) => ({ ...item, cargaId: carga.id, cargaPronta: carga.situacao === 'pronto' })),
        ),
      };
    }),
  );
}

/**
 * Tela 3: "Carga pronta" fecha as cargas de todos os pedidos da viagem, cada
 * uma por `concluirCarga`, que leva o pedido a pronto para envio e a viagem a
 * pronta na última. Item por separar em qualquer entrega recusa tudo.
 * A carga que já chegou pronta fica como está.
 */
export async function concluirViagem(
  client: Client,
  viagemId: string,
  autor: AutorDaMudanca,
): Promise<{ pedidos: number }> {
  const viagem = await travarViagem(client, viagemId);
  exigirEtapa(viagem, 'carregando', 'Esta viagem não está em carregamento.');

  const { rows: faltam } = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
       FROM pedidos_cargas_itens ci
       JOIN pedidos_cargas c ON c.id = ci.carga_id
       JOIN viagens_paradas vp ON vp.pedido_id = c.pedido_id
      WHERE vp.viagem_id = $1 AND ci.separado = false`,
    [viagemId],
  );
  if (faltam[0].n > 0) {
    throw new UserError(faltam[0].n === 1 ? 'Falta separar 1 item.' : `Faltam separar ${faltam[0].n} itens.`);
  }

  const { rows: cargas } = await client.query<{ id: string }>(
    `SELECT c.id
       FROM pedidos_cargas c
       JOIN viagens_paradas vp ON vp.pedido_id = c.pedido_id
      WHERE vp.viagem_id = $1 AND c.situacao <> 'pronto'
      ORDER BY vp.ordem, c.numero_carga`,
    [viagemId],
  );
  for (const carga of cargas) await concluirCarga(client, carga.id, autor);
  // Viagem só com pedido já pronto não passa por `concluirCarga`, que é quem a fecha
  await client.query("UPDATE viagens SET situacao = 'pronta' WHERE id = $1 AND situacao = 'carregando'", [viagemId]);

  const { rows: pedidos } = await client.query<{ n: number }>(
    'SELECT COUNT(*)::int AS n FROM viagens_paradas WHERE viagem_id = $1 AND pedido_id IS NOT NULL',
    [viagemId],
  );
  return { pedidos: pedidos[0].n };
}

/**
 * Tela 2: a sugestão da melhor ordem. Geocodifica o que falta (guardando a
 * coordenada no endereço, para não consultar de novo) e pede a ordem à API.
 *
 * **A rede fica fora da transação.** Segurar a trava da viagem durante oito
 * segundos de API lenta travaria a tela de quem está do outro lado; a ordem é
 * gravada depois, por `salvarOrdem`, que confere se as paradas ainda são as mesmas.
 *
 * Devolve o aviso para a tela, ou `null` quando deu certo.
 */
export async function sugerirRota(pool: Conectavel, viagemId: string): Promise<AvisoDaRota | null> {
  const viagem = await findViagem(pool, viagemId);
  if (!viagem) throw new UserError('Viagem não encontrada.');
  const linhas = await linhasDasParadas(pool, viagemId);

  try {
    let partida: Coordenada | null =
      viagem.partidaLat !== null && viagem.partidaLng !== null ? { lat: viagem.partidaLat, lng: viagem.partidaLng } : null;
    if (!partida) {
      partida = await geocodificarTexto(viagem.partidaDescricao);
      if (!partida) return 'saida_nao_achada';
      await pool.query('UPDATE viagens SET partida_lat = $2, partida_lng = $3 WHERE id = $1', [
        viagemId,
        partida.lat,
        partida.lng,
      ]);
    }

    const situadas = await Promise.all(
      linhas.map(async (linha): Promise<(Coordenada & { id: string }) | null> => {
        if (linha.lat !== null && linha.lng !== null) return { id: linha.id, lat: linha.lat, lng: linha.lng };
        if (linha.pedidoId) {
          const texto = enderecoEmTexto({ logradouro: linha.logradouro, cidade: linha.cidade, uf: linha.uf });
          if (!texto || !linha.enderecoId || linha.naoAchado) return null;
          const achada = await geocodificarTexto(texto);
          await pool.query(
            'UPDATE cadastro.pessoas_enderecos SET lat = $2, lng = $3, geocodificado_em = NOW() WHERE id = $1',
            [linha.enderecoId, achada?.lat ?? null, achada?.lng ?? null],
          );
          return achada ? { id: linha.id, ...achada } : null;
        }
        if (!linha.enderecoAvulso) return null;
        const achada = await geocodificarTexto(linha.enderecoAvulso);
        if (achada) {
          await pool.query('UPDATE viagens_paradas SET lat = $2, lng = $3 WHERE id = $1', [
            linha.id,
            achada.lat,
            achada.lng,
          ]);
        }
        return achada ? { id: linha.id, ...achada } : null;
      }),
    );

    const rota = await otimizarOrdem(
      partida,
      situadas.filter((ponto) => ponto !== null),
    );
    const ordem = aplicarOrdemSugerida(
      linhas.map((linha) => linha.id),
      rota.ordem,
    );
    await withTransaction(pool, (client) =>
      salvarOrdem(client, viagemId, ordem, { distanciaM: rota.distanciaM, duracaoS: rota.duracaoS }),
    );
    return null;
  } catch (error) {
    if (error instanceof MapaIndisponivel) return 'mapa_indisponivel';
    throw error;
  }
}
