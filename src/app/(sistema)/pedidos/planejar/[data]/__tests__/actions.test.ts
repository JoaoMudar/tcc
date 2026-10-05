// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));
vi.mock('@/lib/auth/dal', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/rotas-ors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rotas-ors')>()),
  geocodificarTexto: vi.fn(),
  otimizarOrdem: vi.fn(),
  sugerirEnderecos: vi.fn(),
  enderecoDoPonto: vi.fn(),
}));

const client = { query: vi.fn(), release: vi.fn() };
vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn(async () => client) } }));

const { requireUser } = await import('@/lib/auth/dal');
const { default: pool } = await import('@/lib/db');
const { MapaIndisponivel, enderecoDoPonto, geocodificarTexto, sugerirEnderecos } = await import('@/lib/rotas-ors');
const actions = await import('../actions');

const DIA = '2026-10-02';
const VIAGEM = '3e6a2f4b-1c8d-4f5e-8a3b-5c9d0e1f2a3b';
const PEDIDO = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';
const PARADA = '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e1f';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.append(name, value);
  return data;
}

function gravouEm(trecho: string) {
  return client.query.mock.calls.filter(([sql]) => String(sql).includes(trecho));
}

function expectNoDatabase() {
  expect(pool.query).not.toHaveBeenCalled();
  expect(pool.connect).not.toHaveBeenCalled();
}

let situacaoPedido: string;
let situacaoViagem: string;
let viagemExistente: boolean;
let dataEntregaMudou: boolean;

function viagemRow() {
  return {
    id: VIAGEM,
    data: DIA,
    partidaDescricao: 'Agrolândia, SC',
    partidaLat: null,
    partidaLng: null,
    chegadaDescricao: null,
    chegadaLat: null,
    chegadaLng: null,
    situacao: situacaoViagem,
    sugerirOrdem: true,
    distanciaM: null,
    duracaoS: null,
  };
}

function responder(sql: unknown) {
  const texto = String(sql);
  if (texto.includes('FROM viagens WHERE data')) return { rows: viagemExistente ? [{ id: VIAGEM }] : [], rowCount: 1 };
  if (texto.includes('FROM viagens v WHERE v.id')) return { rows: [viagemRow()], rowCount: 1 };
  if (texto.includes('SELECT valor FROM parametros')) return { rows: [{ valor: 'Agrolândia, SC' }], rowCount: 1 };
  if (texto.includes('INSERT INTO viagens (')) return { rows: [{ id: VIAGEM }], rowCount: 1 };
  if (texto.includes('FROM pedidos WHERE id = $1 FOR UPDATE')) {
    return { rows: [{ id: PEDIDO, numero: 7, situacao: situacaoPedido }], rowCount: 1 };
  }
  if (texto.includes('AS viagens')) return { rows: [{ viagens: 0 }], rowCount: 1 };
  if (texto.includes('AS n')) return { rows: [{ n: 1 }], rowCount: 1 };
  if (texto.includes('UPDATE pedidos SET data_entrega')) return { rows: [], rowCount: dataEntregaMudou ? 1 : 0 };
  if (texto.includes('FROM viagens_paradas vp')) {
    return {
      rows: [{ id: PARADA, pedidoId: PEDIDO, lat: null, lng: null, naoAchado: false, enderecoId: null }],
      rowCount: 1,
    };
  }
  return { rows: [], rowCount: 1 };
}

beforeEach(() => {
  vi.clearAllMocks();
  situacaoPedido = 'aprovado';
  situacaoViagem = 'montando';
  viagemExistente = false;
  dataEntregaMudou = true;
  client.query.mockImplementation(async (sql: unknown) => responder(sql));
  vi.mocked(pool.query).mockImplementation((async (sql: unknown) => responder(sql)) as never);
  vi.mocked(requireUser).mockResolvedValue({
    sessaoId: 's1',
    usuarioId: 'u1',
    login: 'x',
    nomeExibicao: 'X',
    perfil: 'gerencia',
    deveTrocarSenha: false,
    expiraEm: new Date(),
    ultimoUsoEm: new Date(),
  });
});

describe('pôr pedido na carga (Tela 1)', () => {
  it('cria a viagem do dia, põe o pedido e marca a entrega com linha no histórico', async () => {
    const state = await actions.adicionarPedidoAction({}, form({ data: DIA, pedido_id: PEDIDO }));
    expect(state.error).toBeUndefined();
    expect(gravouEm('INSERT INTO viagens (')).toHaveLength(1);
    expect(gravouEm('INSERT INTO viagens_paradas')[0][1]).toEqual([VIAGEM, 1, PEDIDO]);
    expect(gravouEm('UPDATE pedidos SET data_entrega')[0][1]).toEqual([PEDIDO, DIA]);
    const historico = gravouEm('INSERT INTO pedidos_historico');
    expect(historico).toHaveLength(1);
    expect(historico[0][1]).toEqual([PEDIDO, 'aprovado', 'u1', 'Entrega marcada para 02/10 no planejamento da viagem.']);
  });

  it('pedido que já era para o dia não ganha linha no histórico', async () => {
    dataEntregaMudou = false;
    await actions.adicionarPedidoAction({}, form({ data: DIA, pedido_id: PEDIDO }));
    expect(gravouEm('INSERT INTO pedidos_historico')).toHaveLength(0);
  });

  it('usa a viagem que já existe no dia', async () => {
    viagemExistente = true;
    await actions.adicionarPedidoAction({}, form({ data: DIA, pedido_id: PEDIDO }));
    expect(gravouEm('INSERT INTO viagens (')).toHaveLength(0);
    expect(gravouEm('INSERT INTO viagens_paradas')).toHaveLength(1);
  });

  it('pedido separando ou pronto para envio também entra', async () => {
    for (const situacao of ['separando', 'pronto_envio']) {
      vi.clearAllMocks();
      situacaoPedido = situacao;
      const state = await actions.adicionarPedidoAction({}, form({ data: DIA, pedido_id: PEDIDO }));
      expect(state.error).toBeUndefined();
      expect(gravouEm('INSERT INTO viagens_paradas')).toHaveLength(1);
    }
  });

  it('antes de aprovado, não entra', async () => {
    situacaoPedido = 'verificado';
    const state = await actions.adicionarPedidoAction({}, form({ data: DIA, pedido_id: PEDIDO }));
    expect(state.error).toMatch(/só pedido aprovado para cima entra na viagem/);
    expect(gravouEm('INSERT INTO viagens_paradas')).toHaveLength(0);
  });

  it('com a carga já confirmada, recusa', async () => {
    viagemExistente = true;
    situacaoViagem = 'roteirizando';
    const state = await actions.adicionarPedidoAction({}, form({ data: DIA, pedido_id: PEDIDO }));
    expect(state.error).toMatch(/já foi confirmada/);
  });

  it('data ou pedido inválidos não chegam ao banco', async () => {
    expect((await actions.adicionarPedidoAction({}, form({ data: '2026-02-30', pedido_id: PEDIDO }))).error).toBeDefined();
    expect((await actions.adicionarPedidoAction({}, form({ data: DIA, pedido_id: 'x' }))).error).toBeDefined();
    expectNoDatabase();
  });
});

describe('confirmar carga (Tela 1 → Tela 2)', () => {
  it('com o mapa fora do ar, abre a rota com o aviso e a ordem como estava', async () => {
    vi.mocked(geocodificarTexto).mockRejectedValue(new MapaIndisponivel('sem chave'));
    await expect(actions.confirmarCargaAction({}, form({ data: DIA, viagem_id: VIAGEM }))).rejects.toThrow(
      `REDIRECT /pedidos/planejar/${DIA}?aviso=mapa_indisponivel`,
    );
    expect(gravouEm("SET situacao = $2")[0][1]).toEqual([VIAGEM, 'roteirizando']);
    expect(gravouEm('UPDATE viagens_paradas SET ordem')).toHaveLength(0);
  });

  it('carga vazia não vai para a rota', async () => {
    client.query.mockImplementation(async (sql: unknown) =>
      String(sql).includes('AS n') ? { rows: [{ n: 0 }], rowCount: 1 } : responder(sql),
    );
    const state = await actions.confirmarCargaAction({}, form({ data: DIA, viagem_id: VIAGEM }));
    expect(state.error).toMatch(/ao menos um pedido/);
  });
});

describe('os passos do cabeçalho (P17)', () => {
  it('do carregamento volta à rota, sem tocar nas cargas', async () => {
    situacaoViagem = 'carregando';
    const state = await actions.irParaEtapaAction({}, form({ data: DIA, viagem_id: VIAGEM, atual: 'carregando', para: 'roteirizando' }));
    expect(state.error).toBeUndefined();
    expect(gravouEm('UPDATE viagens SET situacao = $2')[0][1]).toEqual([VIAGEM, 'roteirizando']);
    expect(gravouEm('pedidos_cargas')).toHaveLength(0);
  });

  it('do carregamento volta direto à carga', async () => {
    situacaoViagem = 'carregando';
    await actions.irParaEtapaAction({}, form({ data: DIA, viagem_id: VIAGEM, atual: 'carregando', para: 'montando' }));
    expect(gravouEm('UPDATE viagens SET situacao = $2')[0][1]).toEqual([VIAGEM, 'montando']);
  });

  it('a viagem pronta não volta', async () => {
    situacaoViagem = 'pronta';
    const state = await actions.irParaEtapaAction({}, form({ data: DIA, viagem_id: VIAGEM, atual: 'pronta', para: 'roteirizando' }));
    expect(state.error).toMatch(/já está pronta/);
  });

  it('avançar da carga é o mesmo "Confirmar carga"', async () => {
    vi.mocked(geocodificarTexto).mockRejectedValue(new MapaIndisponivel('sem chave'));
    await expect(
      actions.irParaEtapaAction({}, form({ data: DIA, viagem_id: VIAGEM, atual: 'montando', para: 'roteirizando' })),
    ).rejects.toThrow(`REDIRECT /pedidos/planejar/${DIA}?aviso=mapa_indisponivel`);
  });

  it('etapa que não existe é recusada', async () => {
    const state = await actions.irParaEtapaAction({}, form({ data: DIA, viagem_id: VIAGEM, atual: 'montando', para: 'pronta' }));
    expect(state.error).toBe('Etapa inválida.');
    expectNoDatabase();
  });
});

describe('ordem da rota (Tela 2)', () => {
  it('recusa lista com id que não é uuid, sem ir ao banco', async () => {
    const state = await actions.salvarOrdemAction(DIA, VIAGEM, [PARADA, 'x']);
    expect(state.error).toBe('Ordem inválida.');
    expectNoDatabase();
  });

  it('recusa ordem velha: as paradas mudaram enquanto a tela estava aberta', async () => {
    situacaoViagem = 'roteirizando';
    const outra = '2d7f1e5a-0b7c-4e3d-9f2a-4b8c9d0e1f2a';
    const state = await actions.salvarOrdemAction(DIA, VIAGEM, [outra]);
    expect(state.error).toMatch(/paradas mudaram/);
  });

  it('parada extra com endereço escolhido na lista grava a coordenada', async () => {
    situacaoViagem = 'roteirizando';
    const state = await actions.adicionarParadaAction(
      {},
      form({ data: DIA, viagem_id: VIAGEM, descricao: 'Abastecer', endereco: 'Posto, Rio do Sul', lat: '-27.2', lng: '-49.6' }),
    );
    expect(state.error).toBeUndefined();
    expect(gravouEm('INSERT INTO viagens_paradas')[0][1]).toEqual([VIAGEM, 1, 'Abastecer', 'Posto, Rio do Sul', -27.2, -49.6]);
  });

  it('saída digitada e escolhida na lista já vai com a coordenada', async () => {
    situacaoViagem = 'roteirizando';
    await expect(
      actions.definirPartidaAction(
        {},
        form({ data: DIA, viagem_id: VIAGEM, partida: 'outro', endereco: 'Rodoviária, Ibirama', lat: '-27.05', lng: '-49.51' }),
      ),
    ).rejects.toThrow('REDIRECT');
    expect(gravouEm('SET partida_descricao')[0][1]).toEqual([VIAGEM, 'Rodoviária, Ibirama', -27.05, -49.51]);
  });

  it('a volta digitada grava na chegada, e não mexe na saída', async () => {
    situacaoViagem = 'roteirizando';
    await expect(
      actions.definirPartidaAction(
        {},
        form({ data: DIA, viagem_id: VIAGEM, ponta: 'volta', partida: 'outro', endereco: 'Centro, Itapema', lat: '-27.09', lng: '-48.61' }),
      ),
    ).rejects.toThrow('REDIRECT');
    expect(gravouEm('SET chegada_descricao')[0][1]).toEqual([VIAGEM, 'Centro, Itapema', -27.09, -48.61]);
    expect(gravouEm('SET partida_descricao')).toHaveLength(0);
  });

  it('volta em branco é recusada', async () => {
    situacaoViagem = 'roteirizando';
    const state = await actions.definirPartidaAction(
      {},
      form({ data: DIA, viagem_id: VIAGEM, ponta: 'volta', partida: 'outro', endereco: ' ' }),
    );
    expect(state.error).toBe('Digite o endereço de volta.');
  });

  it('parada extra precisa de descrição', async () => {
    situacaoViagem = 'roteirizando';
    const state = await actions.adicionarParadaAction({}, form({ data: DIA, viagem_id: VIAGEM, descricao: ' ' }));
    expect(state.error).toBe('Descreva a parada.');
    expect(state.fields).toEqual({ descricao: ' ', endereco: '' });
  });
});

describe('sugestões de endereço', () => {
  it('texto curto não consulta o mapa', async () => {
    await expect(actions.buscarEnderecosAction('ab')).resolves.toEqual([]);
    expect(sugerirEnderecos).not.toHaveBeenCalled();
  });

  it('mapa fora do ar é lista vazia, e não erro', async () => {
    vi.mocked(sugerirEnderecos).mockRejectedValue(new MapaIndisponivel('sem chave'));
    await expect(actions.buscarEnderecosAction('Rio do Sul')).resolves.toEqual([]);
  });
});

describe('o endereço de entrega completado na rota (P17)', () => {
  const CLIENTE = '5a8c4b6d-3e0f-4b7a-8c5d-7e1f2a3b4c5d';

  function enviar(campos: Record<string, string>) {
    return actions.salvarEnderecoEntregaAction({}, form({ data: DIA, viagem_id: VIAGEM, cliente_id: CLIENTE, ...campos }));
  }

  beforeEach(() => {
    situacaoViagem = 'roteirizando';
  });

  it('a localização colada que não se lê volta como erro, sem ir ao banco', async () => {
    const state = await enviar({ endereco: '', localizacao: 'perto do posto' });
    expect(state.error).toMatch(/não deu para ler a localização/i);
    expect(state.fields?.localizacao).toBe('perto do posto');
    expectNoDatabase();
  });

  it('nada digitado nem colado é recusado', async () => {
    expect((await enviar({ endereco: '', localizacao: '' })).error).toBe('Digite o endereço ou cole a localização.');
  });

  it('só a localização do WhatsApp: o ponto vira o endereço, com a rua achada no mapa', async () => {
    vi.mocked(enderecoDoPonto).mockResolvedValue({ logradouro: 'Estrada Geral', cidade: 'Ibirama', uf: 'SC', cep: null });
    const state = await enviar({ endereco: '', localizacao: 'https://maps.google.com/maps?q=-27.05%2C-49.52&z=17' });
    expect(state.error).toBeUndefined();
    const [[, valores]] = gravouEm('INSERT INTO cadastro.pessoas_enderecos');
    expect(valores).toEqual([CLIENTE, 'Estrada Geral', 'Ibirama', 'SC', null, -27.05, -49.52]);
    expect(gravouEm('sugerir_ordem = sugerir_ordem OR $2')[0][1]).toEqual([VIAGEM, true]);
  });

  it('o mapa fora do ar não impede: o ponto fica com um texto que diz de onde veio', async () => {
    vi.mocked(enderecoDoPonto).mockRejectedValue(new MapaIndisponivel('sem resposta'));
    await enviar({ endereco: '', localizacao: '-27.05, -49.52' });
    const [[, valores]] = gravouEm('INSERT INTO cadastro.pessoas_enderecos');
    expect(valores).toEqual([CLIENTE, 'Localização enviada pelo WhatsApp', null, null, null, -27.05, -49.52]);
  });

  it('o endereço escolhido na lista guarda a rua, e a cidade vai no campo dela', async () => {
    vi.mocked(enderecoDoPonto).mockResolvedValue({ logradouro: 'Rua XV', cidade: 'Rio do Sul', uf: 'SC', cep: '89160-000' });
    await enviar({ endereco: 'Rua XV de Novembro, 120, Rio do Sul, SC, Brasil', lat: '-27.21', lng: '-49.64', localizacao: '' });
    const [[, valores]] = gravouEm('INSERT INTO cadastro.pessoas_enderecos');
    expect(valores).toEqual([CLIENTE, 'Rua XV de Novembro, 120', 'Rio do Sul', 'SC', '89160-000', -27.21, -49.64]);
  });
});
