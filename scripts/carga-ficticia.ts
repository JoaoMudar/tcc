/**
 * Dados FICTÍCIOS de produção para as telas do capítulo 5, só no banco `viveiro_espelho`.
 *
 *   npm run db:carga-ficticia               apaga a carga anterior e grava de novo
 *   npm run db:carga-ficticia -- --remover  devolve o espelho ao que era
 *
 * As datas são relativas a hoje, porque a cor do mapa é derivada do dia. Print em outro
 * dia pede rodar de novo. No fim, a carga confere a situação de cada lote e o saldo
 * contra a soma dos movimentos, e falha se algum não bater.
 *
 * Os lotes, movimentos, tarefas e cargas passam pelas funções do próprio sistema, para
 * obedecer às regras da tela. Como elas usam a data de hoje, um relógio simulado
 * (`emData`) as faz gravar no passado. Só o pedido é inserido direto, com a situação em
 * que ele precisa estar.
 *
 * Os funcionários e clientes daqui são inventados: tarefa "não feita" com o nome de um
 * funcionário real sairia impressa no TCC como se fosse fato.
 *
 * Os pedidos fictícios aparecem na carteira. As telas da seção 5.4 com dado real
 * (`5-4-carteira` e as outras) precisam da carga removida antes do print.
 */
import { loadEnvConfig } from '@next/env';
import pg from 'pg';
import {
  PREFIXO_FICTICIO,
  idFicticio,
  lotesComSaldoDivergente,
  motivoDaRecusa,
  motivoParaNaoMexer,
  segundaDaSemana,
  situacoesDivergentes,
  somaDias,
} from './carga-ficticia-lib.mjs';
import { confirmarAtribuicao, criarAtribuicoes, fecharSemana, adiarAtribuicao, promoverAtribuicao } from '../src/lib/agenda';
import { criarCargaUnica, marcarItemSeparado } from '../src/lib/cargas';
import { hojeNoViveiro } from '../src/lib/datas';
import { alterarAltura, alterarFase, contarLote, criarLote, dividirLote, repicarLote } from '../src/lib/lotes';
import { registrarMovimento } from '../src/lib/movimentos';
import { adiarEtapa, concluirEtapa, concluirEtapaSemAgenda } from '../src/lib/protocolos';
import { concluirViagem, iniciarCarregamento, marcarPedidoCarregado } from '../src/lib/viagens';

loadEnvConfig(process.cwd());

// ------------------------------------------------------------
// Relógio simulado: `new Date()` sem argumento devolve o dia pedido
// ------------------------------------------------------------
const DataReal = Date;
let agora: number | null = null;
class Relogio extends DataReal {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(agora ?? DataReal.now());
    // @ts-expect-error repassa os argumentos do construtor original
    else super(...args);
  }
  static override now() {
    return agora ?? DataReal.now();
  }
}
globalThis.Date = Relogio as DateConstructor;

async function emData<T>(iso: string, fn: () => Promise<T>): Promise<T> {
  agora = DataReal.parse(`${iso}T12:00:00-03:00`);
  try {
    return await fn();
  } finally {
    agora = null;
  }
}

// Começam com "A" para vir antes dos reais na grade da agenda, que ordena por nome
const FUNCIONARIOS = ['Adriana Alves', 'Álvaro Reis', 'Alice Prado', 'Adão Mendes', 'Alda Farias', 'Amanda Campos'];
const CLIENTES = [
  { nome: 'Recupera Ambiental Ltda', tipo: 'pj', cidade: 'Rio do Sul' },
  { nome: 'Prefeitura de Vale Verde', tipo: 'pj', cidade: 'Ituporanga' },
  { nome: 'Jardim Sul Paisagismo', tipo: 'pj', cidade: 'Blumenau' },
  { nome: 'Sítio Três Pinheiros', tipo: 'pf', cidade: 'Agrolândia' },
];

type Db = pg.Client;

// ------------------------------------------------------------
// Remoção: a produção do espelho nasce vazia, então sai inteira
// ------------------------------------------------------------
async function remover(db: Db): Promise<void> {
  const marca = `${PREFIXO_FICTICIO}%`;
  await db.query('BEGIN');
  await db.query(
    `DELETE FROM viagens v USING viagens_paradas vp, pedidos p
      WHERE vp.viagem_id = v.id AND vp.pedido_id = p.id AND p.cliente_id::text LIKE $1`,
    [marca],
  );
  await db.query('DELETE FROM pedidos WHERE cliente_id::text LIKE $1', [marca]);
  await db.query('DELETE FROM movimentos_lote');
  await db.query('DELETE FROM atribuicoes');
  await db.query('DELETE FROM lotes_etapas');
  await db.query('DELETE FROM lotes');
  await db.query('DELETE FROM especies_protocolos_tempos');
  await db.query('DELETE FROM protocolos');
  await db.query('DELETE FROM canteiros');
  await db.query('DELETE FROM areas');
  await db.query('DELETE FROM semanas');
  await db.query('DELETE FROM pessoas WHERE id::text LIKE $1', [marca]);
  await db.query(
    `SELECT setval('pedidos_numero_pedido_seq', GREATEST((SELECT COALESCE(MAX(numero_pedido), 0) FROM pedidos), 1),
                   (SELECT COUNT(*) > 0 FROM pedidos))`,
  );
  await db.query('COMMIT');
}

// ------------------------------------------------------------
// Carga
// ------------------------------------------------------------
async function carregar(db: Db): Promise<void> {
  const H = hojeNoViveiro();
  const d = (n: number) => somaDias(H, n);
  const S0 = segundaDaSemana(H);

  const uma = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
  const usuarioId = async (login: string) => (await uma<{ id: string }>('SELECT id FROM usuarios WHERE login = $1', [login])).id;
  const gerencia = await usuarioId('gerencia');
  const chefia = await usuarioId('chefia');
  const autorChefia = { perfil: 'chefia' as const, usuarioId: chefia };

  const mapa = async (sql: string) =>
    new Map((await db.query<{ k: string; id: string }>(sql)).rows.map((r) => [r.k, r.id]));
  const recipientes = await mapa('SELECT nome AS k, id FROM recipientes');
  const tipos = await mapa('SELECT nome AS k, id FROM tipos_tarefa');
  const turnos = await mapa('SELECT nome AS k, id FROM turnos_trabalho');
  const especies = await mapa(
    `SELECT n.nome AS k, n.especie_id AS id FROM especies_nomes_populares n JOIN especies e ON e.id = n.especie_id AND e.ativa`,
  );
  const pega = (m: Map<string, string>, k: string) => {
    const v = m.get(k);
    if (!v) throw new Error(`Não achei "${k}" no cadastro do espelho.`);
    return v;
  };
  const especie = (k: string) => pega(especies, k);
  const recipiente = (k: string) => pega(recipientes, k);
  const tipo = (k: string) => pega(tipos, k);
  const manha = pega(turnos, 'manha');
  const tarde = pega(turnos, 'tarde');

  // --- Pessoas inventadas -------------------------------------------------
  const pessoas: string[] = [];
  for (const [i, nome] of FUNCIONARIOS.entries()) {
    const id = idFicticio(i + 1);
    await db.query("INSERT INTO pessoas (id, tipo, nome) VALUES ($1, 'pf', $2)", [id, nome]);
    await db.query("INSERT INTO pessoas_papeis (pessoa_id, papel) VALUES ($1, 'funcionario')", [id]);
    pessoas.push(id);
  }
  const [adriana, alvaro, alice, adao, alda, amanda] = pessoas;
  const clientes: string[] = [];
  for (const [i, c] of CLIENTES.entries()) {
    const id = idFicticio(101 + i);
    await db.query('INSERT INTO pessoas (id, tipo, nome) VALUES ($1, $2, $3)', [id, c.tipo, c.nome]);
    await db.query("INSERT INTO pessoas_papeis (pessoa_id, papel) VALUES ($1, 'cliente')", [id]);
    clientes.push(id);
  }

  // --- Áreas e canteiros. D fica toda livre, e E não tem canteiro ----------
  const canteiros = new Map<string, string>();
  const AREAS: [string, string | null, (number | null)[]][] = [
    ['A', 'Sementeiras e tubetes', [12000, 12000, 15000, 15000, 10000, null]],
    ['B', 'Sacos em crescimento', [5000, 5000, 4000, 4000, 3000, 3000, 3000, null]],
    ['C', 'Rustificação e baldes', [2500, 2500, 2500, null, null]],
    ['D', 'Sombrite novo', [3000, 3000, null]],
    ['E', 'Expansão, sem canteiros ainda', []],
  ];
  for (const [letra, nome, capacidades] of AREAS) {
    const { id: areaId } = await uma<{ id: string }>('INSERT INTO areas (letra, nome) VALUES ($1, $2) RETURNING id', [letra, nome]);
    for (const [i, capacidade] of capacidades.entries()) {
      const { id } = await uma<{ id: string }>(
        'INSERT INTO canteiros (area_id, numero, capacidade) VALUES ($1, $2, $3) RETURNING id',
        [areaId, i + 1, capacidade],
      );
      canteiros.set(`${letra}-${i + 1}`, id);
    }
  }
  const canteiro = (k: string) => pega(canteiros, k);
  const areaDe = async (k: string) => (await uma<{ id: string }>('SELECT area_id AS id FROM canteiros WHERE id = $1', [canteiro(k)])).id;

  // --- Protocolos ----------------------------------------------------------
  interface EtapaDef {
    chave: string;
    rotulo: string;
    tipo: string;
    agenda: 'sequencial' | 'recorrente';
    ancora?: string;
    dias: number;
    intervalo?: number;
    turno?: string;
    alerta?: boolean;
    janela?: number;
    fase?: string;
    ativo?: boolean;
  }
  const criarProtocolo = async (nomeRecipiente: string, nome: string, ativo: boolean, observacoes: string | null, etapas: EtapaDef[]) => {
    const { id: protocoloId } = await uma<{ id: string }>(
      'INSERT INTO protocolos (recipiente_id, nome, ativo, observacoes, criado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [recipiente(nomeRecipiente), nome, ativo, observacoes, gerencia],
    );
    const ids = new Map<string, string>();
    for (const [i, e] of etapas.entries()) {
      const { id } = await uma<{ id: string }>(
        `INSERT INTO protocolos_etapas (protocolo_id, tipo_tarefa_id, rotulo, posicao, tipo_agendamento, tipo_ancora, etapa_ancora_id,
                                        dias, intervalo_dias, turno_id, alerta_ligado, janela_aviso_pct, fase_resultante, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [
          protocoloId,
          tipo(e.tipo),
          e.rotulo,
          i + 1,
          e.agenda,
          e.ancora ? 'conclusao_de_etapa' : 'criacao_do_lote',
          e.ancora ? pega(ids, e.ancora) : null,
          e.dias,
          e.intervalo ?? null,
          e.turno ?? manha,
          e.alerta ?? true,
          e.janela ?? null,
          e.fase ?? null,
          e.ativo ?? true,
        ],
      );
      ids.set(e.chave, id);
    }
    return ids;
  };

  const etapasTubete = await criarProtocolo('Tubete 50cm³', 'Tubete: da semeadura à repicagem', true, 'Tempos de referência; espécie lenta declara o seu.', [
    { chave: 'semear', rotulo: 'Semeadura', tipo: 'Semear', agenda: 'sequencial', dias: 0 },
    { chave: 'germinar', rotulo: 'Conferir germinação', tipo: 'Classificar', agenda: 'sequencial', ancora: 'semear', dias: 20, janela: 25, turno: tarde, fase: 'germinado' },
    { chave: 'adubar', rotulo: 'Adubação de cobertura', tipo: 'Adubar', agenda: 'recorrente', ancora: 'germinar', dias: 30, intervalo: 30 },
    { chave: 'repicar', rotulo: 'Repicar para o saco', tipo: 'Repicar', agenda: 'sequencial', ancora: 'germinar', dias: 60, turno: tarde, fase: 'repicado' },
    { chave: 'limpar', rotulo: 'Limpar mato do canteiro', tipo: 'Limpar canteiro', agenda: 'recorrente', dias: 90, intervalo: 90, turno: tarde, alerta: false },
  ]);
  const defSaco: EtapaDef[] = [
    { chave: 's1', rotulo: 'Plantio no saco', tipo: 'Repicar', agenda: 'sequencial', dias: 0, fase: 'repicado' },
    { chave: 's2', rotulo: 'Classificar pega', tipo: 'Classificar', agenda: 'sequencial', ancora: 's1', dias: 30, janela: 50, turno: tarde },
    { chave: 's3', rotulo: 'Adubação de cobertura', tipo: 'Adubar', agenda: 'recorrente', ancora: 's1', dias: 45, intervalo: 45 },
    { chave: 's4', rotulo: 'Liberar para crescimento', tipo: 'Classificar', agenda: 'sequencial', ancora: 's2', dias: 30, fase: 'crescimento' },
    { chave: 's5', rotulo: 'Capina do canteiro', tipo: 'Capinar', agenda: 'recorrente', ancora: 's4', dias: 30, intervalo: 30, turno: tarde },
    { chave: 's6', rotulo: 'Entrar em rustificação', tipo: 'Rustificar', agenda: 'sequencial', ancora: 's4', dias: 120, fase: 'rustificacao' },
    { chave: 's7', rotulo: 'Liberar para venda', tipo: 'Classificar', agenda: 'sequencial', ancora: 's6', dias: 60, janela: 10, fase: 'pronto' },
    { chave: 's8', rotulo: 'Limpar mato do canteiro', tipo: 'Limpar canteiro', agenda: 'recorrente', dias: 90, intervalo: 90, turno: tarde, alerta: false },
    // Etapa desligada: fica no protocolo e não entra nos lotes novos
    { chave: 's9', rotulo: 'Aplicar fungicida (suspensa)', tipo: 'Adubar', agenda: 'recorrente', ancora: 's1', dias: 60, intervalo: 60, ativo: false },
  ];
  const etapasS17 = await criarProtocolo('Saco 17x22', 'Saco 17x22: ciclo completo', true, null, defSaco);
  const etapasS20 = await criarProtocolo('Saco 20x26', 'Saco 20x26: ciclo completo', true, null, defSaco);
  // Protocolo desligado: Saco 10x18, Balde 12 e Balde 25 ficam sem protocolo vigente (UC-22 FA-2)
  await criarProtocolo('Saco 10x18', 'Saco 10x18: versão antiga', false, 'Substituído; mantido para consulta.', defSaco.slice(0, 2));

  // RN-38: espécie lenta declara o próprio tempo de germinação
  for (const [nome, dias, obs] of [
    ['Palmiteiro', 90, 'Germinação lenta e desuniforme.'],
    ['Pinheiro-brasileiro', 45, 'Semente recalcitrante: semear logo após a colheita.'],
  ] as const) {
    await db.query('INSERT INTO especies_protocolos_tempos (especie_id, protocolo_etapa_id, dias, observacoes) VALUES ($1, $2, $3, $4)', [
      especie(nome),
      pega(etapasTubete, 'germinar'),
      dias,
      obs,
    ]);
  }

  // --- Lotes ---------------------------------------------------------------
  interface Lote {
    id: string;
    codigo: string;
    nome: string;
    criado: string;
    etapas: Map<string, string> | null;
  }
  const esperadas: { codigo: string; nome: string; situacao: string }[] = [];
  const espera = (l: Lote, situacao: string) => esperadas.push({ codigo: l.codigo, nome: l.nome, situacao });

  const etapasDe = (nomeRecipiente: string) =>
    nomeRecipiente === 'Tubete 50cm³' ? etapasTubete : nomeRecipiente === 'Saco 17x22' ? etapasS17 : nomeRecipiente === 'Saco 20x26' ? etapasS20 : null;

  const novoLote = async (nome: string, nomeRecipiente: string, onde: string, quantidade: number, criado: string, observacoes: string | null = null): Promise<Lote> => {
    const { id, codigo } = await emData(criado, () =>
      criarLote(db, {
        especieId: especie(nome),
        recipienteId: recipiente(nomeRecipiente),
        canteiroId: canteiro(onde),
        quantidade,
        dataCriacao: criado,
        observacoes,
        registradoPor: gerencia,
      }),
    );
    return { id, codigo, nome, criado, etapas: etapasDe(nomeRecipiente) };
  };
  const feita = (l: Lote, chave: string, data: string) => concluirEtapa(db, l.id, pega(l.etapas!, chave), data);
  const perda = (l: Lote, quantidade: number, causa: 'seca' | 'praga' | 'geada' | 'manuseio' | 'outro', data: string, observacoes: string | null = null) =>
    registrarMovimento(db, { loteId: l.id, tipo: 'perda', quantidade: -quantidade, causa, data, observacoes, registradoPor: gerencia });
  const medir = (l: Lote, alturaM: number) => alterarAltura(db, l.id, alturaM, gerencia);

  /** Leva o lote de saco até a fase, com as recorrentes em dia: sai saudável. */
  const conduzirSaco = async (l: Lote, ate: 'repicado' | 'crescimento' | 'rustificacao' | 'pronto') => {
    await feita(l, 's1', l.criado);
    if (ate === 'repicado') return;
    await feita(l, 's2', somaDias(l.criado, 30));
    await feita(l, 's3', d(-10));
    const noFim = ate === 'crescimento';
    await feita(l, 's4', noFim ? d(-20) : somaDias(l.criado, 60));
    await feita(l, 's5', d(-5));
    await feita(l, 's8', d(-15));
    if (noFim) return;
    await feita(l, 's6', d(-30));
    if (ate === 'pronto') await feita(l, 's7', d(-10));
  };

  // ÁREA A: tubetes. Dois lotes em A-1 passam da capacidade de 12.000 (RN-15)
  const pitanga = await novoLote('Pitanga', 'Tubete 50cm³', 'A-1', 8000, d(-50));
  await feita(pitanga, 'semear', d(-50));
  await feita(pitanga, 'germinar', d(-15));
  await perda(pitanga, 120, 'seca', d(-20), 'Falha na irrigação do fim de semana');
  espera(pitanga, 'saudavel');

  const palmiteiro = await novoLote('Palmiteiro', 'Tubete 50cm³', 'A-1', 6000, d(-12), 'Tempo de germinação próprio da espécie');
  await feita(palmiteiro, 'semear', d(-12));
  espera(palmiteiro, 'saudavel');

  // Etapa vencida há 2 dias: atenção
  const inga = await novoLote('Ingá-feijão', 'Tubete 50cm³', 'A-2', 5000, d(-22));
  await feita(inga, 'semear', d(-22));
  espera(inga, 'atencao');

  // Criado hoje e sem plantio: a semeadura vence hoje
  const araucaria = await novoLote('Pinheiro-brasileiro', 'Tubete 50cm³', 'A-2', 1200, d(0), 'Sementes da coleta de maio');
  espera(araucaria, 'atencao');

  // Vencida, e adiada: 15 dias escolhidos, 25 de deslocamento real (RF-55, TA-82)
  const cedro = await novoLote('Cedro-rosa', 'Tubete 50cm³', 'A-3', 7000, d(-35));
  await feita(cedro, 'semear', d(-35));
  await adiarEtapa(db, cedro.id, pega(etapasTubete, 'germinar'), 15, d(-5), gerencia);
  await db.query("UPDATE lotes_etapas_acoes SET data_acao = $2 WHERE lote_id = $1 AND tipo_acao = 'adiamento'", [cedro.id, d(-5)]);
  espera(cedro, 'saudavel');

  // Vencida há 20 dias: crítico, vindo do protocolo
  const ipeRoxo = await novoLote('Ipê-roxo', 'Tubete 50cm³', 'A-3', 4000, d(-40));
  await feita(ipeRoxo, 'semear', d(-40));
  espera(ipeRoxo, 'critico');

  // Lote que acabou por perda: encerrado com saldo zero, com causas diferentes
  const manaca = await novoLote('Manacá-da-serra', 'Tubete 50cm³', 'A-5', 900, d(-60), 'Sementes de baixa viabilidade');
  await feita(manaca, 'semear', d(-60));
  await perda(manaca, 400, 'praga', d(-40), 'Ataque de formiga-cortadeira');
  await perda(manaca, 500, 'geada', d(-25), 'Geada tardia, sem cobertura');

  // Repicagem parcial, ligada à tarefa confirmada; as que morreram viram perda (RN-20)
  const dataRepicagem = somaDias(S0, -12);
  const guabiroba = await novoLote('Guabiroba', 'Tubete 50cm³', 'A-4', 6000, somaDias(dataRepicagem, -83));
  await feita(guabiroba, 'semear', guabiroba.criado);
  await feita(guabiroba, 'germinar', somaDias(guabiroba.criado, 22));
  const tarefaRepicar = (
    await emData(dataRepicagem, () =>
      criarAtribuicoes(
        db,
        tarefaBase(segundaDaSemana(dataRepicagem), [dataRepicagem], tarde, 'Repicar', [alvaro, alice], {
          loteId: guabiroba.id,
          quantidadePlanejada: 2500,
          loteEtapaId: pega(etapasTubete, 'repicar'),
        }),
        gerencia,
      ),
    )
  )[0];
  await emData(dataRepicagem, () =>
    confirmarAtribuicao(
      db,
      tarefaRepicar,
      {
        loteId: guabiroba.id,
        areaId: null,
        canteiroId: null,
        quantidades: [
          { pessoaId: alvaro, quantidade: 1300 },
          { pessoaId: alice, quantidade: 1200 },
        ],
        perda: null,
      },
      gerencia,
    ),
  );
  const filhoGuabiroba = await emData(dataRepicagem, () =>
    repicarLote(db, {
      origemId: guabiroba.id,
      quantidade: 2500,
      perdidas: 80,
      causa: 'manuseio',
      recipienteId: recipiente('Saco 17x22'),
      canteiroId: canteiro('B-1'),
      observacoes: null,
      registradoPor: gerencia,
      atribuicaoId: tarefaRepicar,
    }),
  );
  await feita(guabiroba, 'adubar', d(-8));
  espera(guabiroba, 'saudavel');
  const guabirobaSaco: Lote = { id: filhoGuabiroba.id, codigo: filhoGuabiroba.codigo, nome: 'Guabiroba', criado: dataRepicagem, etapas: etapasS17 };
  await feita(guabirobaSaco, 's1', dataRepicagem);
  await feita(guabirobaSaco, 's2', somaDias(S0, -1));
  espera(guabirobaSaco, 'saudavel');

  // Repicagem total: o lote de origem encerra, e o novo vence em breve (atenção sem atraso)
  const angico = await novoLote('Angico-vermelho', 'Tubete 50cm³', 'A-5', 3000, d(-110));
  await feita(angico, 'semear', d(-110));
  await feita(angico, 'germinar', d(-85));
  const filhoAngico = await emData(d(-60), () =>
    repicarLote(db, {
      origemId: angico.id,
      quantidade: 2940,
      perdidas: 60,
      causa: 'manuseio',
      recipienteId: recipiente('Saco 17x22'),
      canteiroId: canteiro('B-2'),
      observacoes: 'Leva inteira para o saco',
      registradoPor: gerencia,
    }),
  );
  const angicoSaco: Lote = { id: filhoAngico.id, codigo: filhoAngico.codigo, nome: 'Angico-vermelho', criado: d(-60), etapas: etapasS17 };
  await feita(angicoSaco, 's1', d(-60));
  await feita(angicoSaco, 's2', d(-29));
  await feita(angicoSaco, 's3', d(-14));
  espera(angicoSaco, 'atencao');

  // ÁREA B: divisão. O original encerra, e os dois herdam fase, datas e altura (RN-43)
  const aroeira = await novoLote('Aroeira-vermelha', 'Saco 20x26', 'B-3', 3000, d(-80));
  await feita(aroeira, 's1', d(-80));
  await feita(aroeira, 's2', d(-50));
  await feita(aroeira, 's3', d(-35));
  await feita(aroeira, 's4', d(-19));
  await medir(aroeira, 0.45);
  const divisao = await emData(d(-6), () =>
    dividirLote(db, {
      origemId: aroeira.id,
      quantidade: 1200,
      canteiroA: canteiro('B-3'),
      canteiroB: canteiro('B-4'),
      observacoes: null,
      registradoPor: gerencia,
    }),
  );
  espera({ ...aroeira, codigo: divisao.a.codigo }, 'saudavel');
  espera({ ...aroeira, codigo: divisao.b.codigo }, 'saudavel');

  // Transferência de canteiro: de B-5 para C-1, com a altura medida
  const ipeAmarelo = await novoLote('Ipê-amarelo', 'Saco 20x26', 'B-5', 1800, d(-100));
  await conduzirSaco(ipeAmarelo, 'crescimento');
  await medir(ipeAmarelo, 0.6);
  await registrarMovimento(db, {
    loteId: ipeAmarelo.id,
    tipo: 'transferencia',
    canteiroDestinoId: canteiro('C-1'),
    data: d(-30),
    observacoes: 'Abrir espaço para os sacos novos',
    registradoPor: gerencia,
  });
  espera(ipeAmarelo, 'saudavel');

  // Mortalidade acima do limite de 20%: destaque próprio, cor verde (RF-36)
  const jabuticaba = await novoLote('Jabuticaba', 'Saco 17x22', 'B-6', 2000, d(-70));
  await conduzirSaco(jabuticaba, 'crescimento');
  await perda(jabuticaba, 300, 'geada', d(-60), 'Geada de junho');
  await perda(jabuticaba, 180, 'seca', d(-30));
  await perda(jabuticaba, 140, 'praga', d(-12), 'Cochonilha');
  await perda(jabuticaba, 20, 'outro', d(-3), 'Sacos rasgados por animal');
  espera(jabuticaba, 'saudavel');

  // Mortalidade exatamente em 20%: igual ao limite ainda não destaca
  const ipeBranco = await novoLote('Ipê-branco', 'Saco 17x22', 'B-6', 1000, d(-75));
  await conduzirSaco(ipeBranco, 'crescimento');
  await perda(ipeBranco, 200, 'manuseio', d(-45));
  espera(ipeBranco, 'saudavel');

  // Perda antiga, fora dos 90 dias do filtro padrão da tela de perdas
  const erva = await novoLote('Erva-mate', 'Saco 10x18', 'B-7', 2200, d(-160));
  await perda(erva, 150, 'seca', d(-120));
  await perda(erva, 35, 'praga', d(-20));
  await alterarFase(db, erva.id, 'germinado');
  espera(erva, 'saudavel');

  // Tarefa lançada e não feita na semana passada: crítico, vindo da agenda (RF-55)
  const bracatinga = await novoLote('Bracatinga', 'Saco 17x22', 'B-8', 1500, d(-90));
  await conduzirSaco(bracatinga, 'crescimento');
  espera(bracatinga, 'critico');

  // Tarefa planejada para ontem: um dia de atraso, atenção
  const louro = await novoLote('Louro-pardo', 'Saco 17x22', 'B-8', 1100, d(-85));
  await conduzirSaco(louro, 'crescimento');
  espera(louro, 'atencao');

  // Etapa cumprida no meio de outro serviço, fora da agenda (RF-55)
  const acoita = await novoLote('Açoita-cavalo', 'Saco 20x26', 'B-7', 900, d(-30));
  await feita(acoita, 's1', d(-30));
  await feita(acoita, 's2', d(-1));
  await concluirEtapaSemAgenda(db, acoita.id, pega(etapasS20, 's3'), d(-2), gerencia);
  await db.query("UPDATE lotes_etapas_acoes SET data_acao = $2 WHERE lote_id = $1 AND tipo_acao = 'conclusao_sem_agenda'", [acoita.id, d(-2)]);
  espera(acoita, 'saudavel');

  // ÁREA C: rustificação, pronto e duas contagens (a menos e a mais), RN-17
  const araca = await novoLote('Araçá-amarelo', 'Saco 20x26', 'C-2', 1500, d(-280));
  await conduzirSaco(araca, 'rustificacao');
  await emData(d(-40), () => contarLote(db, { loteId: araca.id, contado: 1463, observacoes: 'Contagem de canteiro: faltaram 37', registradoPor: gerencia }));
  await emData(d(-5), () => contarLote(db, { loteId: araca.id, contado: 1475, observacoes: 'Recontagem: 12 sacos estavam atrás da tela', registradoPor: gerencia }));
  await medir(araca, 0.85);
  espera(araca, 'saudavel');

  // Estoque por faixa de altura: dois lotes de 1,20 m somam, e o de 0,90 m fica à parte
  const canafistula1 = await novoLote('Canafístula', 'Saco 20x26', 'C-3', 800, d(-420), 'Leva do ano passado');
  await conduzirSaco(canafistula1, 'pronto');
  await medir(canafistula1, 1.2);
  espera(canafistula1, 'saudavel');
  const canafistula2 = await novoLote('Canafístula', 'Saco 20x26', 'C-3', 500, d(-400));
  await conduzirSaco(canafistula2, 'pronto');
  await medir(canafistula2, 1.2);
  espera(canafistula2, 'saudavel');
  const canafistula3 = await novoLote('Canafístula', 'Saco 20x26', 'C-2', 600, d(-150));
  await conduzirSaco(canafistula3, 'crescimento');
  await medir(canafistula3, 0.9);
  espera(canafistula3, 'saudavel');

  // Recipiente sem protocolo: a fase anda à mão, e nenhuma etapa cobra (UC-22 FA-2)
  const ipeBalde = await novoLote('Ipê-amarelo', 'Balde 12', 'C-4', 120, d(-500), 'Porte de paisagismo');
  await alterarFase(db, ipeBalde.id, 'crescimento');
  await medir(ipeBalde, 2.3);
  espera(ipeBalde, 'saudavel');
  const araucariaBalde = await novoLote('Pinheiro-brasileiro', 'Balde 25', 'C-4', 40, d(-700));
  await alterarFase(db, araucariaBalde.id, 'pronto');
  await medir(araucariaBalde, 3.5);
  espera(araucariaBalde, 'saudavel');

  // Lotes dos pedidos fictícios: o primeiro é vendido por inteiro e encerra expedido
  const corticaSaco = await novoLote('Cortiça-lisa', 'Saco 17x22', 'B-1', 300, d(-95));
  await conduzirSaco(corticaSaco, 'crescimento');
  const taruma = await novoLote('Tarumã', 'Saco 17x22', 'B-2', 1400, d(-95));
  await conduzirSaco(taruma, 'crescimento');
  await medir(taruma, 0.7);
  espera(taruma, 'saudavel');
  const uvaia = await novoLote('Uvaia', 'Saco 17x22', 'B-5', 1600, somaDias(S0, -36));
  await feita(uvaia, 's1', uvaia.criado);
  // A etapa "Classificar pega" é confirmada na agenda da semana passada, mais abaixo

  // --- Agenda --------------------------------------------------------------
  function tarefaBase(
    semana: string,
    dias: string[],
    turnoId: string,
    nomeTipo: string,
    participantes: string[],
    extra: Partial<Parameters<typeof criarAtribuicoes>[1]> = {},
  ): Parameters<typeof criarAtribuicoes>[1] {
    return {
      semana,
      dias,
      turnoId,
      tipoTarefaId: tipo(nomeTipo),
      horaInicio: null,
      horaFim: null,
      participantes,
      loteId: null,
      especieId: null,
      recipienteId: null,
      areaId: null,
      canteiroId: null,
      quantidadePlanejada: null,
      recorrente: false,
      observacoes: null,
      loteEtapaId: null,
      ...extra,
    };
  }

  type Situacao = 'planejada' | 'feita';
  interface Tarefa {
    data: string;
    turno: string;
    tipo: string;
    gente: string[];
    extra?: Partial<Parameters<typeof criarAtribuicoes>[1]>;
    /** O que aconteceu. Em dia futuro ela fica planejada, seja o que for. */
    fim?: Situacao;
    /** A contagem de cada pessoa, na ordem de `gente`. */
    contou?: (number | null)[];
    perda?: { quantidade: number; causa: 'seca' | 'praga' | 'geada' | 'manuseio' | 'outro' };
  }
  const lancar = async ({ data, turno, tipo: nomeTipo, gente, extra = {}, fim = 'planejada', contou, perda: morta }: Tarefa) => {
    const [id] = await emData(data <= H ? data : H, () =>
      criarAtribuicoes(db, tarefaBase(segundaDaSemana(data), [data], turno, nomeTipo, gente, extra), gerencia),
    );
    if (fim === 'feita' && data <= H) {
      await emData(data, () =>
        confirmarAtribuicao(
          db,
          id,
          {
            loteId: extra.loteId ?? null,
            areaId: extra.areaId ?? null,
            canteiroId: extra.canteiroId ?? null,
            quantidades: gente.map((pessoaId, i) => ({ pessoaId, quantidade: contou?.[i] ?? null })),
            perda: morta ?? null,
          },
          gerencia,
        ),
      );
    }
    return id;
  };

  // Duas semanas fechadas, S-21 e S-14: confirmada, assumida e cancelada por falta de gente
  for (const inicio of [somaDias(S0, -21), somaDias(S0, -14)]) {
    const dia = (n: number) => somaDias(inicio, n);
    await lancar({ data: dia(0), turno: manha, tipo: 'Peneirar terra', gente: [amanda], fim: 'feita' });
    await lancar({ data: dia(0), turno: tarde, tipo: 'Encher saquinho', gente: [adriana, alda], extra: { recipienteId: recipiente('Saco 17x22'), quantidadePlanejada: 1500 }, fim: 'feita', contou: [800, 750] });
    await lancar({ data: dia(1), turno: manha, tipo: 'Colher semente', gente: [adao], extra: { especieId: especie('Pitanga'), quantidadePlanejada: 60 }, fim: 'feita', contou: [60] });
    await lancar({ data: dia(1), turno: tarde, tipo: 'Beneficiar semente', gente: [adao, amanda], extra: { especieId: especie('Pitanga'), quantidadePlanejada: 60 } }); // vira presumida no fechamento
    await lancar({ data: dia(2), turno: manha, tipo: 'Capinar', gente: [alvaro], extra: { loteId: pitanga.id }, fim: 'feita' });
    await lancar({ data: dia(3), turno: manha, tipo: 'Carregar caminhao', gente: [] }); // sem ninguém: cancelada no fechamento
    await lancar({ data: dia(3), turno: tarde, tipo: 'Encher bandeja', gente: [alice], extra: { recipienteId: recipiente('Tubete 50cm³'), quantidadePlanejada: 2000 }, fim: 'feita', contou: [2000] });
    await lancar({ data: dia(4), turno: manha, tipo: 'Adubar', gente: [alvaro, alice], extra: { loteId: taruma.id }, fim: 'feita' });
  }

  // Semana passada, aberta, para fechar: mostra o "?" do que falta confirmar
  const SP = somaDias(S0, -7);
  await lancar({ data: SP, turno: manha, tipo: 'Peneirar terra', gente: [amanda], extra: { horaInicio: '07:30', horaFim: '09:30', recorrente: true } });
  await lancar({ data: SP, turno: tarde, tipo: 'Encher saquinho', gente: [adriana, alda], extra: { recipienteId: recipiente('Saco 20x26'), quantidadePlanejada: 1200 }, fim: 'feita', contou: [700, 500] });
  await lancar({ data: somaDias(SP, 1), turno: manha, tipo: 'Classificar', gente: [alice, adao], extra: { loteId: uvaia.id, quantidadePlanejada: 1600, loteEtapaId: pega(etapasS17, 's2') }, fim: 'feita', contou: [800, 760], perda: { quantidade: 40, causa: 'seca' } });
  await lancar({ data: somaDias(SP, 2), turno: tarde, tipo: 'Capinar', gente: [alvaro, amanda], extra: { loteId: bracatinga.id, observacoes: 'Mato alto no fundo do canteiro' } });
  await lancar({ data: somaDias(SP, 3), turno: manha, tipo: 'Colher semente', gente: [adao], extra: { especieId: especie('Cedro-rosa'), quantidadePlanejada: 30 } });
  await lancar({ data: somaDias(SP, 4), turno: manha, tipo: 'Carregar caminhao', gente: [] });
  await feita(uvaia, 's3', somaDias(S0, -3));
  espera(uvaia, 'saudavel');

  // Semana de hoje: todos os estados da grade, de segunda a domingo
  const dia = (n: number) => somaDias(S0, n);
  const irrigacao = { loteId: pitanga.id, horaInicio: '07:00', horaFim: '08:00', recorrente: true };
  for (const n of [0, 1, 2, 3, 4, 5, 6]) {
    const ehHoje = dia(n) === H;
    await lancar({ data: dia(n), turno: manha, tipo: 'Irrigar', gente: n > 4 ? [amanda] : [amanda, adriana], extra: irrigacao, fim: ehHoje ? 'planejada' : 'feita' });
  }
  await lancar({ data: dia(0), turno: manha, tipo: 'Encher saquinho', gente: [adriana, alda], extra: { recipienteId: recipiente('Saco 17x22'), quantidadePlanejada: 1000, horaInicio: '08:00', horaFim: '11:30' }, fim: 'feita', contou: [600, 500] });
  await lancar({ data: dia(0), turno: tarde, tipo: 'Encher bandeja', gente: [alice], extra: { recipienteId: recipiente('Tubete 50cm³'), quantidadePlanejada: 800 }, fim: 'feita', contou: [300] });
  await lancar({ data: dia(1), turno: manha, tipo: 'Colher semente', gente: [adao], extra: { especieId: especie('Uvaia'), quantidadePlanejada: 40, observacoes: 'Chuva: frutos ainda verdes na matriz' }, fim: 'feita', contou: [0] });
  const principal = await lancar({ data: dia(1), turno: tarde, tipo: 'Capinar', gente: [alvaro, amanda], extra: { loteId: taruma.id, horaInicio: '13:00', horaFim: '15:00' }, fim: 'feita' });
  await lancar({ data: dia(1), turno: tarde, tipo: 'Adubar', gente: [alice], extra: { loteId: jabuticaba.id, horaInicio: '14:00', horaFim: '16:30' }, fim: 'feita' });
  await promoverAtribuicao(db, principal);
  await lancar({ data: dia(2), turno: manha, tipo: 'Adubar', gente: [alvaro], extra: { loteId: ipeAmarelo.id, areaId: await areaDe('C-1'), canteiroId: canteiro('C-1') }, fim: 'feita' });
  await lancar({ data: dia(2), turno: tarde, tipo: 'Classificar', gente: [alice, alda], extra: { loteId: jabuticaba.id, quantidadePlanejada: 1360 }, fim: 'feita', contou: [700, 640] });
  await lancar({ data: dia(3), turno: manha, tipo: 'Limpar canteiro', gente: [amanda], extra: { loteId: guabirobaSaco.id, observacoes: 'Corredor B-1 e B-2' }, fim: 'feita' });
  await lancar({ data: dia(3), turno: tarde, tipo: 'Beneficiar semente', gente: [adao, adriana], extra: { especieId: especie('Pitanga'), quantidadePlanejada: 80 }, fim: 'feita', contou: [null, null] });
  await lancar({ data: dia(4), turno: manha, tipo: 'Rustificar', gente: [alvaro, alda], extra: { loteId: araca.id }, fim: 'feita' });
  await lancar({ data: dia(4), turno: tarde, tipo: 'Encher saquinho', gente: [adriana], extra: { recipienteId: recipiente('Saco 20x26'), quantidadePlanejada: 500 } });

  // A que o encerramento do lote vai cancelar na venda (RF-58), e a planejada de ontem, que deixa o lote em atenção
  await lancar({ data: dia(4), turno: manha, tipo: 'Capinar', gente: [alice], extra: { loteId: corticaSaco.id } });
  await lancar({ data: d(-1), turno: tarde, tipo: 'Adubar', gente: [alice], extra: { loteId: louro.id } });

  // Hoje e os próximos dias: planejadas, inclusive a tarefa do protocolo adiada
  await lancar({ data: d(0), turno: tarde, tipo: 'Adubar', gente: [alvaro, alice], extra: { loteId: ipeBranco.id, observacoes: 'Reforço antes da chuva prevista' } });
  await lancar({ data: d(1), turno: manha, tipo: 'Repicar', gente: [adao, adriana], extra: { loteId: guabiroba.id, quantidadePlanejada: 1000 } });
  await lancar({ data: d(2), turno: tarde, tipo: 'Encher saquinho', gente: [adriana, alda], extra: { recipienteId: recipiente('Saco 28x32'), quantidadePlanejada: 800 } });
  await lancar({ data: d(3), turno: manha, tipo: 'Colher semente', gente: [adao], extra: { especieId: especie('Guabiroba'), quantidadePlanejada: 50 } });
  const paraAdiar = await lancar({ data: d(4), turno: tarde, tipo: 'Capinar', gente: [alvaro], extra: { loteId: taruma.id, loteEtapaId: pega(etapasS17, 's5') } });
  await adiarAtribuicao(db, paraAdiar, 3, H, gerencia);
  await lancar({ data: d(8), turno: manha, tipo: 'Adubar', gente: [alvaro], extra: { loteId: guabiroba.id } });

  // A abertura da semana copiou a recorrente da anterior (RN-29): as de dias já passados foram feitas
  const { rows: copiadas } = await db.query<{ id: string; data: string; pessoa: string }>(
    `SELECT a.id, to_char(a.data_trabalho, 'YYYY-MM-DD') AS data, p.pessoa_id AS pessoa
       FROM atribuicoes a JOIN atribuicoes_participantes p ON p.atribuicao_id = a.id
      WHERE a.situacao = 'planejada' AND a.e_recorrente AND a.lote_id IS NULL AND a.data_trabalho >= $1 AND a.data_trabalho <= $2`,
    [S0, H],
  );
  for (const c of copiadas) {
    await emData(c.data, () =>
      confirmarAtribuicao(db, c.id, { loteId: null, areaId: null, canteiroId: null, quantidades: [{ pessoaId: c.pessoa, quantidade: null }], perda: null }, gerencia),
    );
  }

  // Fecha as duas semanas antigas, pela rotina do sistema
  for (const inicio of [somaDias(S0, -21), somaDias(S0, -14)]) await fecharSemana(db, inicio, H, gerencia);

  // --- Pedidos fictícios: os que a produção atende ------------------------
  interface ItemDef {
    especie: string;
    recipiente: string;
    quantidade: number;
    preco: number | null;
    altura?: number;
    disponivel?: boolean;
    quantidadeDisponivel?: number;
  }
  const novoPedido = async (
    cliente: number,
    canal: string,
    situacao: string,
    entrega: string | null,
    criado: string,
    trilha: string[],
    itens: ItemDef[],
    observacoes: string | null = null,
  ) => {
    const { id } = await uma<{ id: string }>(
      `INSERT INTO pedidos (cliente_id, canal_venda, situacao, data_entrega, criado_por, criado_em, observacoes, entrega_logradouro, entrega_cidade, entrega_uf)
       VALUES ($1, $2, $3, $4, $5, $6::date + TIME '09:00', $7, $8, $9, 'SC') RETURNING id`,
      [clientes[cliente], canal, situacao, entrega, chefia, criado, observacoes, 'Estrada Geral, s/n', CLIENTES[cliente].cidade],
    );
    for (const i of itens) {
      const conferido = i.disponivel !== undefined;
      await db.query(
        `INSERT INTO pedidos_itens (pedido_id, especie_id, recipiente_id, quantidade, preco_unitario, altura_m, disponivel, quantidade_disponivel,
                                    conferido_por, conferido_em, precificado_por, precificado_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12::date)`,
        [
          id,
          especie(i.especie),
          recipiente(i.recipiente),
          i.quantidade,
          i.preco,
          i.altura ?? null,
          i.disponivel ?? null,
          i.quantidadeDisponivel ?? null,
          conferido ? gerencia : null,
          conferido ? criado : null,
          i.preco ? chefia : null,
          i.preco ? criado : null,
        ],
      );
    }
    let anterior: string | null = null;
    for (const [i, nova] of trilha.entries()) {
      await db.query(
        `INSERT INTO pedidos_historico (pedido_id, situacao_anterior, situacao_nova, alterado_por, criado_em)
         VALUES ($1, $2, $3, $4, $5::date + TIME '09:00' + make_interval(hours => $6))`,
        [id, anterior, nova, chefia, criado, i],
      );
      anterior = nova;
    }
    return id;
  };
  const TRILHA = ['cadastrado', 'verificando', 'verificado', 'aprovado'];
  /** O histórico gravado pelas funções do sistema leva a data do fato, e não a de hoje. */
  const datarHistorico = (pedidoId: string, data: string) =>
    db.query(
      `UPDATE pedidos_historico SET criado_em = $2::date + TIME '10:00'
        WHERE pedido_id = $1 AND situacao_nova = 'separando'`,
      [pedidoId, data],
    ).then(() =>
      db.query(
        `UPDATE pedidos_historico SET criado_em = $2::date + TIME '16:00'
          WHERE pedido_id = $1 AND situacao_nova = 'pronto_envio'`,
        [pedidoId, data],
      ),
    ).then(() =>
      db.query(
        `UPDATE pedidos_historico SET criado_em = $2::date + TIME '17:00'
          WHERE pedido_id = $1 AND situacao_nova = 'carregado'`,
        [pedidoId, data],
      ),
    );
  const ok = (especieNome: string, nomeRecipiente: string, quantidade: number, preco: number, altura?: number): ItemDef => ({
    especie: especieNome,
    recipiente: nomeRecipiente,
    quantidade,
    preco,
    altura,
    disponivel: true,
  });

  const novaViagem = async (data: string, pedidoId: string, cidade: string) => {
    const { id } = await uma<{ id: string }>(
      `INSERT INTO viagens (data, partida_descricao, situacao, sugerir_ordem, distancia_m, duracao_s, criado_por)
       VALUES ($1, 'Agrolândia, SC', 'roteirizando', false, 48000, 3600, $2) RETURNING id`,
      [data, chefia],
    );
    await db.query('INSERT INTO viagens_paradas (viagem_id, ordem, pedido_id, endereco) VALUES ($1, 1, $2, $3)', [
      id,
      pedidoId,
      `Estrada Geral, s/n, ${cidade}, SC`,
    ]);
    return id;
  };

  // Venda concluída: a viagem baixa os lotes. Cortiça-lisa zera e encerra como expedido
  const pedidoVendido = await novoPedido(0, 'compensacao', 'aprovado', d(-4), d(-15), TRILHA, [
    ok('Cortiça-lisa', 'Saco 17x22', 300, 7.5),
    ok('Canafístula', 'Saco 20x26', 150, 12, 1.2),
    ok('Tarumã', 'Saco 17x22', 200, 8, 0.7),
  ]);
  const viagemPronta = await novaViagem(d(-4), pedidoVendido, CLIENTES[0].cidade);
  await emData(d(-4), async () => {
    await iniciarCarregamento(db, viagemPronta, autorChefia);
    await marcarPedidoCarregado(db, viagemPronta, pedidoVendido, true, gerencia);
    await concluirViagem(db, viagemPronta, autorChefia);
  });
  await datarHistorico(pedidoVendido, d(-4));

  // Viagem em carregamento: a carga está no caminhão, e o saldo ainda não baixou
  const pedidoCarregando = await novoPedido(1, 'prefeitura', 'aprovado', d(1), d(-10), TRILHA, [
    ok('Ipê-amarelo', 'Saco 20x26', 300, 11, 0.6),
    ok('Jabuticaba', 'Saco 17x22', 100, 15),
  ]);
  const viagemCarregando = await novaViagem(d(1), pedidoCarregando, CLIENTES[1].cidade);
  await emData(d(-1), () => iniciarCarregamento(db, viagemCarregando, autorChefia));
  await datarHistorico(pedidoCarregando, d(-1));

  // Em separação: um item já marcado, com o lote sugerido pelo sistema (RF-24)
  const pedidoSeparando = await novoPedido(2, 'paisagismo', 'aprovado', d(3), d(-8), TRILHA, [
    ok('Ipê-amarelo', 'Balde 12', 20, 95, 2.3),
    ok('Pinheiro-brasileiro', 'Balde 25', 5, 240, 3.5),
    ok('Canafístula', 'Saco 20x26', 100, 12, 1.2),
    ok('Araçá-amarelo', 'Saco 20x26', 200, 9, 0.85),
  ]);
  await emData(d(-2), () => criarCargaUnica(db, pedidoSeparando, autorChefia));
  await datarHistorico(pedidoSeparando, d(-2));
  const { id: primeiroItem } = await uma<{ id: string }>(
    `SELECT ci.id FROM pedidos_cargas_itens ci JOIN pedidos_cargas c ON c.id = ci.carga_id
      WHERE c.pedido_id = $1 ORDER BY ci.quantidade LIMIT 1`,
    [pedidoSeparando],
  );
  await marcarItemSeparado(db, primeiroItem, true, gerencia);

  // As situações que faltavam no espelho: aprovado, verificado e pendente de alteração
  await novoPedido(3, 'varejo', 'aprovado', d(10), d(-6), TRILHA, [ok('Pitanga', 'Tubete 50cm³', 500, 2.2), ok('Uvaia', 'Saco 17x22', 80, 7)]);
  await novoPedido(0, 'compensacao', 'verificado', d(15), d(-4), TRILHA.slice(0, 3), [
    ok('Angico-vermelho', 'Saco 17x22', 1500, 6.5),
    { especie: 'Aroeira-vermelha', recipiente: 'Saco 20x26', quantidade: 2000, preco: null, disponivel: false, quantidadeDisponivel: 1800 },
  ]);
  await novoPedido(2, 'paisagismo', 'pendente_alteracao', d(20), d(-3), [...TRILHA.slice(0, 3), 'pendente_alteracao'], [ok('Ipê-amarelo', 'Balde 12', 30, 95, 2.3)], 'Cliente quer trocar parte por ipê-rosa');

  // --- Ajuste dos carimbos ------------------------------------------------
  // As funções gravam NOW(); o que a tela mostra como data precisa ser a do fato
  await db.query(
    `UPDATE lotes l SET encerrado_em = (SELECT MAX(m.data_movimento) FROM movimentos_lote m WHERE m.lote_id = l.id) + TIME '16:00'
      WHERE l.encerrado_em IS NOT NULL`,
  );
  await db.query(`UPDATE lotes SET criado_em = data_criacao + TIME '08:00'`);
  await db.query(`UPDATE lotes SET altura_medida_em = $1::date - 3 + TIME '10:00' WHERE altura_m IS NOT NULL`, [H]);
  await db.query(`UPDATE atribuicoes SET confirmado_em = data_trabalho + TIME '17:30' WHERE confirmado_em IS NOT NULL`);

  // --- Conferência --------------------------------------------------------
  const { rows: saldos } = await db.query(
    `SELECT l.codigo, l.quantidade_atual AS saldo, COALESCE(SUM(m.quantidade), 0) AS soma
       FROM lotes l LEFT JOIN movimentos_lote m ON m.lote_id = l.id GROUP BY l.id`,
  );
  const divergentes = lotesComSaldoDivergente(saldos);
  if (divergentes.length > 0) throw new Error(`Saldo diferente da soma dos movimentos: ${divergentes.join(', ')}`);

  const { rows: situacoes } = await db.query<{ codigo: string; situacao: string }>(
    'SELECT codigo_lote AS codigo, situacao FROM situacao_lote',
  );
  const erradas = situacoesDivergentes(esperadas, situacoes);
  if (erradas.length > 0) throw new Error(`Situação inesperada:\n  ${erradas.join('\n  ')}`);
}

async function resumo(db: Db): Promise<void> {
  const linhas = await db.query<{ item: string; n: string }>(
    `SELECT 'lotes abertos' AS item, COUNT(*)::text AS n FROM lotes WHERE encerrado_em IS NULL
     UNION ALL SELECT 'lotes encerrado: ' || motivo_encerramento, COUNT(*)::text FROM lotes WHERE encerrado_em IS NOT NULL GROUP BY motivo_encerramento
     UNION ALL SELECT 'situação: ' || situacao, COUNT(*)::text FROM situacao_lote GROUP BY situacao
     UNION ALL SELECT 'fase: ' || fase, COUNT(*)::text FROM lotes GROUP BY fase
     UNION ALL SELECT 'movimento: ' || tipo_movimento, COUNT(*)::text FROM movimentos_lote GROUP BY tipo_movimento
     UNION ALL SELECT 'causa de perda: ' || causa_perda, COUNT(*)::text FROM movimentos_lote WHERE causa_perda IS NOT NULL GROUP BY causa_perda
     UNION ALL SELECT 'tarefa: ' || situacao, COUNT(*)::text FROM atribuicoes GROUP BY situacao
     UNION ALL SELECT 'semana: ' || situacao, COUNT(*)::text FROM semanas GROUP BY situacao
     UNION ALL SELECT 'ação na etapa: ' || tipo_acao, COUNT(*)::text FROM lotes_etapas_acoes GROUP BY tipo_acao
     UNION ALL SELECT 'pedido: ' || situacao, COUNT(*)::text FROM pedidos GROUP BY situacao
     UNION ALL SELECT 'viagem: ' || situacao, COUNT(*)::text FROM viagens GROUP BY situacao
     ORDER BY 1`,
  );
  for (const { item, n } of linhas.rows) console.log(`  ${item.padEnd(38)} ${n}`);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const recusa = motivoDaRecusa(url);
  if (recusa) throw new Error(`Carga recusada: ${recusa}`);

  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    const { rows } = await db.query<{ producao: number; ficticias: number }>(
      `SELECT (SELECT COUNT(*)::int FROM areas) + (SELECT COUNT(*)::int FROM protocolos) + (SELECT COUNT(*)::int FROM lotes)
              + (SELECT COUNT(*)::int FROM atribuicoes) AS producao,
              (SELECT COUNT(*)::int FROM pessoas WHERE id::text LIKE $1) AS ficticias`,
      [`${PREFIXO_FICTICIO}%`],
    );
    const parar = motivoParaNaoMexer(rows[0]);
    if (parar) throw new Error(`Carga recusada: ${parar}`);

    await remover(db);
    if (process.argv.includes('--remover')) {
      console.log('Carga fictícia removida do viveiro_espelho.');
      return;
    }
    // Sem transação de propósito: cada escrita ganha o próprio NOW(), que desempata
    // os movimentos do mesmo dia na ficha. Se falhar no meio, rodar de novo limpa e refaz.
    await carregar(db);
    console.log('Carga fictícia gravada no viveiro_espelho:');
    await resumo(db);
  } finally {
    await db.end();
  }
}

main().catch((erro) => {
  console.error(erro.message ?? erro);
  process.exit(1);
});
