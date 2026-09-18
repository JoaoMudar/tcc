// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Perfil } from '@/lib/permissions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock('@/lib/auth/dal', () => ({ requireUser: vi.fn() }));

const client = { query: vi.fn(), release: vi.fn() };
vi.mock('@/lib/db', () => ({ default: { query: vi.fn(), connect: vi.fn(async () => client) } }));

const { requireUser } = await import('@/lib/auth/dal');
const { default: pool } = await import('@/lib/db');
const { FORBIDDEN_MESSAGE } = await import('@/lib/auth/guards');
const especies = await import('../especies/actions');
const recipientes = await import('../recipientes/actions');
const insumos = await import('../insumos/actions');
const areas = await import('../areas/actions');
const tipos = await import('../tipos-tarefa/actions');
const pessoas = await import('../pessoas/actions');
const protocolos = await import('../protocolos/actions');

const ID = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';

function loggedAs(perfil: Perfil) {
  vi.mocked(requireUser).mockResolvedValue({
    sessaoId: 's1',
    usuarioId: 'u1',
    login: 'x',
    nomeExibicao: 'X',
    perfil,
    deveTrocarSenha: false,
    expiraEm: new Date(),
    ultimoUsoEm: new Date(),
  });
}

function form(values: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

function expectNoDatabase() {
  expect(pool.query).not.toHaveBeenCalled();
  expect(pool.connect).not.toHaveBeenCalled();
}

const PESSOA = { tipo: 'pf', nome: 'Rogério Steilein', telefone: '(47) 99845-1120', papel_cliente: 'on', ativa: 'on' };

beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockReset();
});

describe('permissões do cadastro (D4 §3.4)', () => {
  it('gerência não cria espécie, recipiente, insumo nem pessoa, e o banco nem é consultado', async () => {
    loggedAs('gerencia');
    await expect(especies.saveEspecieAction({}, form({ nome_cientifico: 'Cedrela fissilis' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(recipientes.createRecipiente({}, form({ nome: 'Tubete', volume: '' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(insumos.createInsumo({}, form({ nome: 'Adubo' }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(pessoas.savePessoaAction({}, form(PESSOA))).rejects.toThrow(FORBIDDEN_MESSAGE);
    await expect(pessoas.createClienteRapido({}, form({ nome: 'Sítio', telefone: '47996124408' }))).rejects.toThrow(
      FORBIDDEN_MESSAGE,
    );
    expectNoDatabase();
  });

  it('gerência que forja o bloco fiscal é recusada', async () => {
    loggedAs('gerencia');
    await expect(
      pessoas.savePessoaAction({}, form({ ...PESSOA, pessoa_id: ID, inclui_fiscal: '1', documento: '52998224725' })),
    ).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });

  it('chefia cria tipo de tarefa, mas não altera (D4: C L)', async () => {
    loggedAs('chefia');
    await expect(tipos.saveTipoTarefa({}, form({ tipo_id: ID, nome: 'Regar', categoria: 'manutencao' }))).rejects.toThrow(
      FORBIDDEN_MESSAGE,
    );
    await expect(areas.deleteCanteiro({}, form({ canteiro_id: ID }))).rejects.toThrow(FORBIDDEN_MESSAGE);
    expectNoDatabase();
  });
});

describe('áreas e canteiros (RF-13)', () => {
  it('gerência cria canteiro', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: ID }] } as never);
    const state = await areas.createCanteiro({}, form({ area_id: ID, numero: '7', capacidade: '' }));
    expect(state).toEqual({ success: 'Canteiro 7 criado.' });
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([ID, 7, null]);
  });

  it('TA-09: número repetido na mesma área volta com a mensagem e o número digitado', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query)
      .mockRejectedValueOnce({ code: '23505', constraint: 'canteiros_numero_unico_na_area' })
      .mockResolvedValueOnce({ rows: [{ letra: 'A' }] } as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = await areas.createCanteiro({}, form({ area_id: ID, numero: '7', capacidade: '' }));
    expect(state).toEqual({
      error: 'O canteiro 7 já existe na área A. Escolha outro número.',
      fields: { numero: '7', capacidade: '' },
    });
  });

  it('letra inválida não chega ao banco', async () => {
    loggedAs('gerencia');
    const state = await areas.createArea({}, form({ letra: '7', nome: '' }));
    expect(state.error).toMatch(/uma letra/);
    expectNoDatabase();
  });
});

describe('protocolo de atividades (RF-22 a RF-24, UC-17)', () => {
  const ETAPA = '2d7c1b0a-4e5f-4a6b-8c9d-1e2f3a4b5c6d';
  const OUTRA = '3e8d2c1b-5f6a-4b7c-9d0e-2f3a4b5c6d7e';

  /** Campos de uma etapa válida, para cada caso mexer só no que testa. */
  const etapa = (extra: Record<string, string> = {}) => ({
    protocolo_id: ID,
    tipo_tarefa_id: ETAPA,
    rotulo: 'Classificar pós-germinação',
    tipo_agendamento: 'sequencial',
    tipo_ancora: 'criacao_do_lote',
    dias: '40',
    turno_id: OUTRA,
    ...extra,
  });

  /**
   * A coluna do admin no D4 é `L`, e ainda assim ele passa: `can` devolve `true`
   * para o admin antes de consultar a matriz (D4 §1.1), e é o único ponto do
   * código que decide isso. A coluna registra a intenção, e o acesso irrestrito
   * é a exceção declarada, coberta por `permissions.test.ts`.
   */
  it('D4 §1.1: o admin atravessa a própria coluna e monta protocolo', async () => {
    loggedAs('admin');
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: ID }] } as never);
    await expect(
      protocolos.saveProtocolo({}, form({ recipiente_id: ID, nome: 'Protocolo do tubete', observacoes: '' })),
    ).rejects.toThrow(`redirect:/cadastros/protocolos/${ID}?salvo=1`);
  });

  it('a chefia e a gerência montam o protocolo (D4: as duas CLA)', async () => {
    for (const perfil of ['chefia', 'gerencia'] as const) {
      vi.clearAllMocks();
      loggedAs(perfil);
      vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: ID }] } as never);
      await expect(
        protocolos.saveProtocolo({}, form({ recipiente_id: ID, nome: 'Protocolo do tubete', observacoes: '' })),
      ).rejects.toThrow(`redirect:/cadastros/protocolos/${ID}?salvo=1`);
      expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([ID, 'Protocolo do tubete', null, 'u1']);
    }
  });

  it('FE-3: segundo protocolo vigente para o mesmo recipiente volta com a mensagem, e não com o erro do Postgres', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query).mockRejectedValueOnce({ code: '23505', constraint: 'protocolos_um_vigente_por_recipiente' });
    const state = await protocolos.saveProtocolo({}, form({ recipiente_id: ID, nome: 'Outro do tubete', observacoes: '' }));
    expect(state.error).toBe('Este recipiente já tem um protocolo vigente. Edite o que existe, em vez de criar outro.');
  });

  it('FE-1 e TA-36: a âncora circular é recusada, e nada é gravado', async () => {
    loggedAs('gerencia');
    // listEtapas: o plantio já conta da classificação, então classificar não pode contar do plantio
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        { id: ETAPA, rotulo: 'Plantar no tubete', etapaAncoraId: OUTRA },
        { id: OUTRA, rotulo: 'Classificar pós-germinação', etapaAncoraId: null },
      ],
    } as never);

    const state = await protocolos.saveEtapa(
      {},
      form(etapa({ etapa_id: OUTRA, tipo_ancora: 'conclusao_de_etapa', etapa_ancora_id: ETAPA })),
    );

    expect(state.error).toMatch(/forma um ciclo/);
    expect(state.error).toMatch(/Plantar no tubete/);
    // A consulta das etapas aconteceu; a escrita, não
    expect(vi.mocked(pool.query)).toHaveBeenCalledTimes(1);
  });

  it('FE-2: recorrente sem intervalo não chega ao banco', async () => {
    loggedAs('gerencia');
    const state = await protocolos.saveEtapa({}, form(etapa({ tipo_agendamento: 'recorrente' })));
    expect(state.error).toMatch(/intervalo/);
    expectNoDatabase();
  });

  it('RN-34: etapa que repete não avança fase, e a recusa é anterior ao banco', async () => {
    loggedAs('gerencia');
    const state = await protocolos.saveEtapa(
      {},
      form(etapa({ tipo_agendamento: 'recorrente', intervalo_dias: '90', fase_resultante: 'germinado' })),
    );
    expect(state.error).toBe('Etapa que repete não avança a fase do lote. Deixe a fase em branco.');
    expectNoDatabase();
  });

  it('a etapa válida é gravada com a âncora resolvida e o alerta declarado', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never) // listEtapas: protocolo ainda sem etapas
      .mockResolvedValueOnce({ rows: [{ id: ETAPA }] } as never);

    const state = await protocolos.saveEtapa({}, form(etapa({ alerta_ligado: 'on' })));

    expect(state).toEqual({ success: 'Etapa Classificar pós-germinação acrescentada.' });
    expect(vi.mocked(pool.query).mock.calls[1][1]).toEqual([
      ID,
      ETAPA,
      'Classificar pós-germinação',
      'sequencial',
      'criacao_do_lote',
      null,
      40,
      null,
      OUTRA,
      true,
      null,
      null,
    ]);
  });
});

describe('tempo de etapa por espécie (RF-25, UC-18)', () => {
  const ETAPA = '2d7c1b0a-4e5f-4a6b-8c9d-1e2f3a4b5c6d';

  it('o guard é do protocolo, e não da espécie: a gerência grava o tempo', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    const state = await protocolos.saveTempoEspecie(
      {},
      form({ especie_id: ID, protocolo_etapa_id: ETAPA, dias: '70', intervalo_dias: '', observacoes: '' }),
    );
    expect(state).toEqual({ success: 'Tempo da espécie salvo.' });
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual([ID, ETAPA, 70, null, null]);
  });

  it('FA-1: os dois campos em branco apagam a linha, em vez de gravar zero', async () => {
    loggedAs('chefia');
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    const state = await protocolos.saveTempoEspecie(
      {},
      form({ especie_id: ID, protocolo_etapa_id: ETAPA, dias: '', intervalo_dias: '', observacoes: '' }),
    );
    expect(state).toEqual({ success: 'Tempo próprio removido: volta a valer o do protocolo.' });
    expect(String(vi.mocked(pool.query).mock.calls[0][0])).toMatch(/DELETE FROM especies_protocolos_tempos/);
  });

  it('zero não chega ao banco', async () => {
    loggedAs('gerencia');
    const state = await protocolos.saveTempoEspecie(
      {},
      form({ especie_id: ID, protocolo_etapa_id: ETAPA, dias: '0', intervalo_dias: '', observacoes: '' }),
    );
    expect(state.error).toMatch(/deixe em branco/i);
    expectNoDatabase();
  });
});

describe('tipos de tarefa (RF-21)', () => {
  it('gerência cria e vai para a ficha; com lote exigido, espécie e área não são gravadas', async () => {
    loggedAs('gerencia');
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: ID }] } as never);
    await expect(
      tipos.saveTipoTarefa(
        {},
        form({
          nome: 'Rustificar',
          categoria: 'manutencao',
          exige_lote: 'on',
          exige_especie: 'on',
          exige_area: 'on',
          e_quantitativa: 'on',
          unidade_medida: 'kg',
        }),
      ),
    ).rejects.toThrow(`redirect:/cadastros/tipos-tarefa/${ID}?salvo=1`);
    expect(vi.mocked(pool.query).mock.calls[0][1]).toEqual(['Rustificar', 'manutencao', true, true, false, false, false, 'kg']);
  });

  it('unidade fora da lista é recusada sem tocar o banco', async () => {
    loggedAs('gerencia');
    const state = await tipos.saveTipoTarefa({}, form({ nome: 'Colher semente', categoria: 'semente', unidade_medida: 'quilo' }));
    expect(state.error).toBe('Escolha a unidade da quantidade.');
    expectNoDatabase();
  });
});

describe('espécies (RF-10)', () => {
  it('arquivo que não é foto é recusado sem tocar o banco', async () => {
    loggedAs('chefia');
    const state = await especies.saveEspecieAction(
      {},
      form({ nome_cientifico: 'Cedrela fissilis', foto: new File(['<svg/>'], 'foto.jpg', { type: 'image/jpeg' }) }),
    );
    expect(state.error).toBe('O arquivo não é uma foto. Use JPG, PNG ou WEBP.');
    expectNoDatabase();
  });

  it('chefia cria espécie numa transação e vai para a ficha', async () => {
    loggedAs('chefia');
    client.query.mockImplementation(async (sql: string) =>
      sql.includes('INSERT INTO especies ') ? { rows: [{ id: ID }] } : { rows: [], rowCount: 1 },
    );
    await expect(
      especies.saveEspecieAction({}, form({ nome_cientifico: 'Cedrela fissilis', nomes_populares: 'Cedro-rosa\nCedro' })),
    ).rejects.toThrow(`redirect:/cadastros/especies/${ID}?salvo=1`);
    const sqls = client.query.mock.calls.map((call) => String(call[0]));
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls.at(-1)).toBe('COMMIT');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO especies_nomes_populares'), [
      ID,
      ['Cedro-rosa', 'Cedro'],
    ]);
  });
});

describe('pessoas (RF-14 a RF-17)', () => {
  it('TA-50: CPF inválido volta com a mensagem e os campos preenchidos, sem tocar o banco', async () => {
    loggedAs('chefia');
    const valores = { ...PESSOA, inclui_fiscal: '1', documento: '529.982.247-24' };
    const state = await pessoas.savePessoaAction({}, form(valores));
    expect(state).toEqual({ error: 'CPF inválido. Confira os números.', fields: valores });
    expectNoDatabase();
  });

  it('RF-14: telefone já cadastrado devolve quem tem o número, sem criar', async () => {
    loggedAs('chefia');
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: ID, nome: 'Marlene Cardoso' }] } as never);
    const state = await pessoas.savePessoaAction({}, form(PESSOA));
    expect(state.candidatas).toEqual([{ id: ID, nome: 'Marlene Cardoso' }]);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('documento de outra pessoa é recusado com o link para ela', async () => {
    loggedAs('chefia');
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: ID, nome: 'Boa Vista Agropecuária' }] } as never);
    const state = await pessoas.savePessoaAction({}, form({ ...PESSOA, inclui_fiscal: '1', documento: '529.982.247-25' }));
    expect(state).toMatchObject({ existente: { id: ID }, error: 'Boa Vista Agropecuária já está cadastrada com esse documento.' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('confirmado que é outra pessoa, cria com o papel numa transação', async () => {
    loggedAs('chefia');
    client.query.mockImplementation(async (sql: string) =>
      sql.includes('INSERT INTO cadastro.pessoas ') ? { rows: [{ id: ID }] } : { rows: [], rowCount: 1 },
    );
    await expect(pessoas.savePessoaAction({}, form({ ...PESSOA, confirmar_novo: '1' }))).rejects.toThrow(
      `redirect:/cadastros/pessoas/${ID}?salvo=1`,
    );
    expect(pool.query).not.toHaveBeenCalled();
    const sqls = client.query.mock.calls.map((call) => String(call[0]));
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls.some((sql) => sql.includes('INSERT INTO cadastro.pessoas_papeis'))).toBe(true);
    expect(sqls.at(-1)).toBe('COMMIT');
  });

  it('RF-15: cliente rápido exige telefone, e reaproveita quem já existe', async () => {
    loggedAs('chefia');
    expect(await pessoas.createClienteRapido({}, form({ nome: 'Sítio Boa Vista', telefone: '' }))).toMatchObject({
      error: 'Informe o telefone do cliente.',
    });
    expectNoDatabase();

    vi.mocked(pool.query).mockResolvedValue({ rows: [{ nome: 'Marlene Cardoso' }] } as never);
    const state = await pessoas.createClienteRapido({}, form({ nome: 'Marlene', telefone: '47997330987', usar_pessoa_id: ID }));
    expect(state).toEqual({ success: 'Marlene Cardoso agora também é cliente.', cliente: { id: ID, nome: 'Marlene Cardoso' } });
  });
});
