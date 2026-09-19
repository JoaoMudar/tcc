import type { PoolClient } from 'pg';
import type { Area } from './areas';
import { hojeNoViveiro, isDataIso } from './datas';
import { UserError } from './errors';
import {
  type CanteiroResumo,
  type CausaPerda,
  type Fase,
  type TipoMovimento,
  FASES_EDITAVEIS,
  formatQuantidade,
  lerQuantidade,
} from './lotes-rotulos';
import { proximaPosicao, registrarMovimento, travarLote } from './movimentos';
// `protocolos.ts` não importa daqui: importa de `lotes-rotulos`, que é sem `pg`.
// É o que mantém a seta num sentido só e evita o ciclo.
import { materializarProtocolo } from './protocolos';
import type { Db } from './sql';

export {
  FASES,
  FASES_EDITAVEIS,
  avisoCapacidade,
  canteiroLabel,
  type CanteiroResumo,
  type Fase,
} from './lotes-rotulos';

type Client = Pick<PoolClient, 'query'>;

const MAX_QUANTIDADE = 10_000_000;

/** Nome da espécie na tela: o popular principal, ou o científico. `e` é o alias de `especies`. */
export function nomeEspecieSql(e: string): string {
  return `COALESCE((SELECT n.nome FROM especies_nomes_populares n WHERE n.especie_id = ${e}.id
                     ORDER BY n.e_principal DESC, n.criado_em, n.nome LIMIT 1), ${e}.nome_cientifico)`;
}

export function parseQuantidade(text: string, { zero = false } = {}): { error: string } | { value: number } {
  const numero = lerQuantidade(text);
  if (numero === null || numero < (zero ? 0 : 1) || numero > MAX_QUANTIDADE) {
    return {
      error: zero
        ? 'Informe quantas mudas foram contadas, em número inteiro.'
        : 'A quantidade precisa ser um número inteiro de mudas, maior que zero.',
    };
  }
  return { value: numero };
}

export function parseFase(text: string): { error: string } | { value: Exclude<Fase, 'encerrado'> } {
  const fase = FASES_EDITAVEIS.find((f) => f === text);
  return fase ? { value: fase as Exclude<Fase, 'encerrado'> } : { error: 'Escolha a fase na lista.' };
}

/** Vazia vale hoje; depois de hoje não, porque o lote registra a leva que já ocupa canteiro. */
export function parseDataCriacao(text: string, hoje: string): { error: string } | { value: string } {
  const texto = text.trim();
  if (texto === '') return { value: hoje };
  if (!isDataIso(texto)) return { error: 'A data de criação é inválida.' };
  if (texto > hoje) return { error: 'A data de criação não pode ser depois de hoje.' };
  return { value: texto };
}

export function parseObservacoes(text: string): { error: string } | { value: string | null } {
  const texto = text.trim();
  if (texto.length > 500) return { error: 'A observação pode ter até 500 caracteres.' };
  return { value: texto || null };
}

/** C8: `AAAA-NNNN`, ano de plantio e sequência dentro do ano. O código não carrega endereço. */
export function nextCodigo(ano: number, ultimo: string | null): string {
  const sequencia = ultimo ? Number(ultimo.split('-')[1]) + 1 : 1;
  return `${ano}-${String(sequencia).padStart(4, '0')}`;
}

async function gerarCodigo(client: Client, ano: number): Promise<string> {
  // Duas criações no mesmo ano esperam uma pela outra, e não pegam o mesmo número
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`lotes.codigo.${ano}`]);
  const { rows } = await client.query<{ codigo: string }>(
    'SELECT codigo FROM lotes WHERE codigo LIKE $1 ORDER BY length(codigo) DESC, codigo DESC LIMIT 1',
    [`${ano}-%`],
  );
  return nextCodigo(ano, rows[0]?.codigo ?? null);
}

export interface NovoLote {
  especieId: string;
  recipienteId: string;
  canteiroId: string;
  quantidade: number;
  /** Quando a leva passou a ocupar canteiro. A data real do plantio é do protocolo (T6.7). */
  dataCriacao: string;
  observacoes: string | null;
  registradoPor: string;
}

interface InsercaoLote extends NovoLote {
  loteOrigemId: string | null;
  fase: Fase;
  tipoEntrada: Extract<TipoMovimento, 'entrada' | 'repicagem_entrada'>;
  atribuicaoId?: string | null;
}

async function inserirLote(client: Client, input: InsercaoLote): Promise<{ id: string; codigo: string }> {
  const { rows: catalogo } = await client.query<{ especie: boolean | null; recipiente: boolean | null }>(
    `SELECT (SELECT ativa FROM especies WHERE id = $1) AS especie,
            (SELECT ativo FROM recipientes WHERE id = $2) AS recipiente`,
    [input.especieId, input.recipienteId],
  );
  const { especie, recipiente } = catalogo[0];
  if (especie === null) throw new UserError('Espécie não encontrada.');
  // Na repicagem a espécie vem do lote de origem, e a leva continua existindo mesmo com a espécie fora de uso
  if (!especie && !input.loteOrigemId) throw new UserError('A espécie está fora de uso. Reative no cadastro antes de criar lote.');
  if (recipiente === null) throw new UserError('Recipiente não encontrado.');
  if (!recipiente) throw new UserError('O recipiente está fora de uso. Reative no cadastro antes de usá-lo.');

  const posicao = await proximaPosicao(client, input.canteiroId);
  if (posicao === null) throw new UserError('Canteiro não encontrado.');
  const codigo = await gerarCodigo(client, Number(input.dataCriacao.slice(0, 4)));

  // Nasce com saldo zero: quem põe as mudas é o movimento de entrada, e a soma dos movimentos fecha com o saldo
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO lotes (codigo, especie_id, recipiente_id, canteiro_id, lote_origem_id, quantidade_inicial,
                        quantidade_atual, fase, data_criacao, posicao, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10)
     RETURNING id`,
    [
      codigo,
      input.especieId,
      input.recipienteId,
      input.canteiroId,
      input.loteOrigemId,
      input.quantidade,
      input.fase,
      input.dataCriacao,
      posicao,
      input.observacoes,
    ],
  );
  const id = rows[0].id;
  await registrarMovimento(client, {
    loteId: id,
    tipo: input.tipoEntrada,
    quantidade: input.quantidade,
    data: input.dataCriacao,
    atribuicaoId: input.atribuicaoId,
    registradoPor: input.registradoPor,
  });

  // RF-46: o lote nasce seguindo o protocolo vigente do recipiente dele. Na
  // repicagem o recipiente e outro, e por isso o lote novo segue outro
  // protocolo: e o vasilhame que determina o manejo (RN-30), e a muda que passou
  // do tubete para o saco comeca o manejo do saco, contado da criacao dela.
  await materializarProtocolo(client, id, input.recipienteId, input.dataCriacao);
  return { id, codigo };
}

/** T4.2, RF-32: código gerado, posição no fim do canteiro e movimento de entrada. */
export async function criarLote(client: Client, input: NovoLote): Promise<{ id: string; codigo: string }> {
  return inserirLote(client, { ...input, loteOrigemId: null, fase: 'semeado', tipoEntrada: 'entrada' });
}

export interface Repicagem {
  origemId: string;
  quantidade: number;
  /** Mudas que morreram no processo: viram perda do lote de origem (RN-27). */
  perdidas: number;
  causa: CausaPerda | null;
  recipienteId: string;
  canteiroId: string;
  observacoes: string | null;
  registradoPor: string;
  /** A tarefa confirmada que a repicagem fecha (UC-20 FA-1): os movimentos apontam para ela. */
  atribuicaoId?: string | null;
}

/** T4.8, RF-34: a repicagem não move o lote; baixa o de origem e cria um novo apontando para ele. */
export async function repicarLote(
  client: Client,
  input: Repicagem,
): Promise<{ id: string; codigo: string; saldoOrigem: number; origemEncerrado: boolean }> {
  const origem = await travarLote(client, input.origemId);
  if (!origem) throw new UserError('Lote não encontrado.');
  if (origem.encerrado) throw new UserError(`O lote ${origem.codigo} está encerrado e não pode ser repicado.`);
  if (input.recipienteId === origem.recipienteId) {
    throw new UserError('A repicagem muda o recipiente. Para trocar só de canteiro, use a transferência.');
  }

  const total = input.quantidade + input.perdidas;
  if (total > origem.quantidadeAtual) {
    const detalhe =
      input.perdidas > 0 ? ` (${formatQuantidade(input.quantidade)} repicadas e ${formatQuantidade(input.perdidas)} perdidas)` : '';
    throw new UserError(
      `O lote ${origem.codigo} tem ${formatQuantidade(origem.quantidadeAtual)} mudas, e a repicagem pede ${formatQuantidade(total)}${detalhe}.`,
    );
  }

  const hoje = hojeNoViveiro();
  if (input.perdidas > 0) {
    if (!input.causa) throw new UserError('Escolha a causa das mudas que morreram na repicagem.');
    await registrarMovimento(client, {
      loteId: origem.id,
      tipo: 'perda',
      quantidade: -input.perdidas,
      causa: input.causa,
      data: hoje,
      observacoes: 'Morreram na repicagem',
      atribuicaoId: input.atribuicaoId,
      registradoPor: input.registradoPor,
    });
  }

  const saida = await registrarMovimento(client, {
    loteId: origem.id,
    tipo: 'repicagem_saida',
    quantidade: -input.quantidade,
    data: hoje,
    observacoes: input.observacoes,
    atribuicaoId: input.atribuicaoId,
    registradoPor: input.registradoPor,
  });

  const novo = await inserirLote(client, {
    especieId: origem.especieId,
    recipienteId: input.recipienteId,
    canteiroId: input.canteiroId,
    quantidade: input.quantidade,
    dataCriacao: hoje,
    observacoes: input.observacoes,
    registradoPor: input.registradoPor,
    loteOrigemId: origem.id,
    fase: 'repicado',
    tipoEntrada: 'repicagem_entrada',
    atribuicaoId: input.atribuicaoId,
  });
  return { ...novo, saldoOrigem: saida.saldo, origemEncerrado: saida.encerrado };
}

/**
 * T4.6, RF-39: a contagem vale mais que o calculado (RN-09). A diferença vira o
 * movimento de ajuste; sem diferença não há o que gravar, porque movimento de
 * quantidade zero só existe na transferência.
 */
export async function contarLote(
  client: Client,
  input: { loteId: string; contado: number; observacoes: string | null; registradoPor: string },
): Promise<{ codigo: string; diferenca: number; saldo: number; encerrado: boolean }> {
  const lote = await travarLote(client, input.loteId);
  if (!lote) throw new UserError('Lote não encontrado.');
  if (lote.encerrado) throw new UserError(`O lote ${lote.codigo} está encerrado e não recebe contagem.`);

  const diferenca = input.contado - lote.quantidadeAtual;
  if (diferenca === 0) return { codigo: lote.codigo, diferenca, saldo: lote.quantidadeAtual, encerrado: false };

  const resultado = await registrarMovimento(client, {
    loteId: lote.id,
    tipo: 'ajuste_contagem',
    quantidade: diferenca,
    observacoes: input.observacoes,
    registradoPor: input.registradoPor,
  });
  return { codigo: lote.codigo, diferenca, ...resultado };
}

/**
 * A gerência troca a fase à mão. Só lote aberto; `encerrado` não é fase que se
 * escolhe: essa só a porta de movimentos põe.
 *
 * **Continua existindo depois do protocolo (T6.7), e deixou de ser provisório.**
 * O protocolo avança a fase sozinho ao concluir etapa sequencial que declare
 * fase resultante (RF-48), mas o lote de recipiente sem protocolo não tem etapa
 * nenhuma, e sem este caminho ele nunca chegaria a `pronto`, que é o que o saldo
 * do pedido lê (RF-43). Serve também para corrigir engano.
 */
export async function alterarFase(db: Db, loteId: string, fase: Exclude<Fase, 'encerrado'>): Promise<'ok' | 'nao_encontrado'> {
  const { rowCount } = await db.query('UPDATE lotes SET fase = $2 WHERE id = $1 AND encerrado_em IS NULL', [loteId, fase]);
  return rowCount ? 'ok' : 'nao_encontrado';
}

export async function listCanteirosParaLote(db: Db): Promise<CanteiroResumo[]> {
  const { rows } = await db.query<CanteiroResumo>(
    `SELECT c.id, a.id AS "areaId", a.letra, c.numero, c.capacidade,
            COUNT(l.id)::int AS lotes, COALESCE(SUM(l.quantidade_atual), 0)::int AS mudas
       FROM canteiros c
       JOIN areas a ON a.id = c.area_id
       LEFT JOIN lotes l ON l.canteiro_id = c.id AND l.encerrado_em IS NULL
      GROUP BY c.id, a.id
      ORDER BY a.letra, c.numero`,
  );
  return rows;
}

export interface LoteAberto {
  id: string;
  codigo: string;
  canteiroId: string;
  posicao: number | null;
  especie: string;
  recipiente: string;
  fase: Fase;
  saldo: number;
}

export async function listLotesAbertos(db: Db): Promise<LoteAberto[]> {
  const { rows } = await db.query<LoteAberto>(
    `SELECT l.id, l.codigo, l.canteiro_id AS "canteiroId", l.posicao, ${nomeEspecieSql('e')} AS especie,
            r.nome AS recipiente, l.fase, l.quantidade_atual AS saldo
       FROM lotes l
       JOIN especies e ON e.id = l.especie_id
       JOIN recipientes r ON r.id = l.recipiente_id
      WHERE l.encerrado_em IS NULL
      ORDER BY l.posicao NULLS LAST, l.codigo`,
  );
  return rows;
}

export interface CanteiroOcupado {
  id: string;
  numero: number;
  capacidade: number | null;
  lotes: LoteAberto[];
  mudas: number;
  livre: boolean;
}

export interface AreaOcupada {
  id: string;
  letra: string;
  nome: string | null;
  canteiros: CanteiroOcupado[];
  livres: number;
}

/** T4.3, RF-33: cada canteiro com os seus lotes abertos, e o que não tem nenhum marcado livre. */
export function montarOcupacao(areas: readonly Area[], lotes: readonly LoteAberto[]): AreaOcupada[] {
  const porCanteiro = new Map<string, LoteAberto[]>();
  for (const lote of lotes) porCanteiro.set(lote.canteiroId, [...(porCanteiro.get(lote.canteiroId) ?? []), lote]);

  return areas.map((area) => {
    const canteiros = area.canteiros.map((canteiro) => {
      const doCanteiro = porCanteiro.get(canteiro.id) ?? [];
      return {
        ...canteiro,
        lotes: doCanteiro,
        mudas: doCanteiro.reduce((soma, lote) => soma + lote.saldo, 0),
        livre: doCanteiro.length === 0,
      };
    });
    return { id: area.id, letra: area.letra, nome: area.nome, canteiros, livres: canteiros.filter((c) => c.livre).length };
  });
}

export interface FichaLote {
  id: string;
  codigo: string;
  especieId: string;
  especie: string;
  nomeCientifico: string;
  recipienteId: string;
  recipiente: string;
  canteiroId: string | null;
  canteiro: string | null;
  fase: Fase;
  quantidadeInicial: number;
  quantidadeAtual: number;
  dataCriacao: string;
  /** Nula enquanto a etapa de plantio não for concluída: vazio significa que ainda não germinou. */
  dataPlantio: string | null;
  encerradoEm: Date | null;
  motivoEncerramento: string | null;
  observacoes: string | null;
  origemId: string | null;
  origemCodigo: string | null;
  perdas: number;
  filhos: { id: string; codigo: string }[];
}

/** T4.4, RF-35: a ficha, com o lote de origem e os que nasceram deste. */
export async function findLote(db: Db, id: string): Promise<FichaLote | null> {
  const { rows } = await db.query<FichaLote>(
    `SELECT l.id, l.codigo, l.especie_id AS "especieId", ${nomeEspecieSql('e')} AS especie,
            e.nome_cientifico AS "nomeCientifico", l.recipiente_id AS "recipienteId", r.nome AS recipiente,
            l.canteiro_id AS "canteiroId", a.letra || '-' || c.numero AS canteiro, l.fase,
            l.quantidade_inicial AS "quantidadeInicial", l.quantidade_atual AS "quantidadeAtual",
            to_char(l.data_criacao, 'YYYY-MM-DD') AS "dataCriacao",
            to_char(l.data_plantio, 'YYYY-MM-DD') AS "dataPlantio", l.encerrado_em AS "encerradoEm",
            l.motivo_encerramento AS "motivoEncerramento", l.observacoes,
            o.id AS "origemId", o.codigo AS "origemCodigo",
            COALESCE((SELECT -SUM(m.quantidade) FROM movimentos_lote m
                       WHERE m.lote_id = l.id AND m.tipo_movimento = 'perda'), 0)::int AS perdas,
            COALESCE((SELECT json_agg(json_build_object('id', f.id, 'codigo', f.codigo) ORDER BY f.codigo)
                        FROM lotes f WHERE f.lote_origem_id = l.id), '[]') AS filhos
       FROM lotes l
       JOIN especies e ON e.id = l.especie_id
       JOIN recipientes r ON r.id = l.recipiente_id
       LEFT JOIN canteiros c ON c.id = l.canteiro_id
       LEFT JOIN areas a ON a.id = c.area_id
       LEFT JOIN lotes o ON o.id = l.lote_origem_id
      WHERE l.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export interface Movimento {
  id: string;
  tipo: TipoMovimento;
  quantidade: number;
  data: string;
  causa: CausaPerda | null;
  canteiroOrigem: string | null;
  canteiroDestino: string | null;
  registradoPor: string;
  observacoes: string | null;
}

export async function listMovimentos(db: Db, loteId: string): Promise<Movimento[]> {
  const { rows } = await db.query<Movimento>(
    `SELECT m.id, m.tipo_movimento AS tipo, m.quantidade, to_char(m.data_movimento, 'YYYY-MM-DD') AS data,
            m.causa_perda AS causa, ao.letra || '-' || co.numero AS "canteiroOrigem",
            ad.letra || '-' || cd.numero AS "canteiroDestino", u.nome_exibicao AS "registradoPor", m.observacoes
       FROM movimentos_lote m
       JOIN usuarios u ON u.id = m.registrado_por
       LEFT JOIN canteiros co ON co.id = m.canteiro_origem_id
       LEFT JOIN areas ao ON ao.id = co.area_id
       LEFT JOIN canteiros cd ON cd.id = m.canteiro_destino_id
       LEFT JOIN areas ad ON ad.id = cd.area_id
      WHERE m.lote_id = $1
      ORDER BY m.data_movimento, m.criado_em`,
    [loteId],
  );
  return rows;
}

/** RF-35: a soma dos movimentos tem de reproduzir o saldo. Divergência é defeito. */
export function saldoDosMovimentos(movimentos: readonly Pick<Movimento, 'quantidade'>[]): number {
  return movimentos.reduce((soma, movimento) => soma + movimento.quantidade, 0);
}
