import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classificar, enviarGuardado, esvaziarFila } from '../fila-envio';
import { EVENTO_FILA, enfileirar, limpar, listar } from '../fila-local';

const CHAVES = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];

function resposta(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

async function guardar(chave: string, rotulo = 'Perda de 5 no lote 2026-0001') {
  await enfileirar({ chave, tipo: 'perda', campos: { lote_id: 'l1', quantidade: '5', causa: 'seca' }, rotulo });
  // A ordem é pela hora de criação: sem esta pausa, dois registros podem empatar no milissegundo
  await new Promise((fim) => setTimeout(fim, 2));
}

beforeEach(async () => {
  await limpar();
});

describe('fila do aparelho (T9.3)', () => {
  it('TA-59: o registro fica guardado com a chave, pendente, e avisa quem está ouvindo', async () => {
    const ouvinte = vi.fn();
    window.addEventListener(EVENTO_FILA, ouvinte);
    await guardar(CHAVES[0]);
    window.removeEventListener(EVENTO_FILA, ouvinte);
    expect(await listar()).toEqual([
      expect.objectContaining({ chave: CHAVES[0], tipo: 'perda', situacao: 'pendente', rotulo: 'Perda de 5 no lote 2026-0001' }),
    ]);
    expect(ouvinte).toHaveBeenCalled();
  });

  it('sair limpa tudo (E4 A-08)', async () => {
    await guardar(CHAVES[0]);
    await limpar();
    expect(await listar()).toEqual([]);
  });
});

describe('classificar a resposta da rota', () => {
  it.each([
    ['gravado', resposta(200, { success: 'Perda registrada.' }), { tipo: 'gravado', success: 'Perda registrada.' }],
    ['recusado', resposta(422, { error: 'Saldo insuficiente.', fields: { quantidade: '5' } }), { tipo: 'recusado', error: 'Saldo insuficiente.' }],
    ['perfil sem permissão', resposta(403, { error: 'Seu perfil não permite.' }), { tipo: 'recusado' }],
    ['sessão vencida', resposta(401, { error: 'Entre de novo.' }), { tipo: 'sem_sessao', error: 'Entre de novo.' }],
    ['servidor fora', resposta(503, {}), { tipo: 'sem_rede' }],
    ['página no lugar de JSON', new Response('<html>', { status: 200 }), { tipo: 'sem_rede' }],
  ])('%s', async (_caso, r, esperado) => {
    expect(await classificar(r)).toMatchObject(esperado);
  });

  it('o redirecionamento do proxy para o login é sessão vencida, e não gravado', async () => {
    const redirecionada = { type: 'opaqueredirect', status: 0, json: async () => ({}) } as unknown as Response;
    expect(await classificar(redirecionada)).toMatchObject({ tipo: 'sem_sessao' });
  });
});

describe('envio (T9.4)', () => {
  it('manda a chave e os campos como JSON, sem seguir redirecionamento', async () => {
    await guardar(CHAVES[0]);
    const buscar = vi.fn(async () => resposta(200, { success: 'ok' }));
    await enviarGuardado({ chave: CHAVES[0], tipo: 'perda', campos: { quantidade: '5' } }, { buscar });
    expect(buscar).toHaveBeenCalledWith('/api/registros', expect.objectContaining({ method: 'POST', redirect: 'manual' }));
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ chave: CHAVES[0], tipo: 'perda', campos: { quantidade: '5' } });
  });

  it('gravado sai da fila; recusado fica marcado com o motivo; sem rede fica como estava', async () => {
    for (const chave of CHAVES) await guardar(chave);
    const respostas = [resposta(200, { success: 'ok' }), resposta(422, { error: 'Lote encerrado.' })];
    const buscar = vi.fn(async () => {
      const proxima = respostas.shift();
      if (!proxima) throw new TypeError('Failed to fetch');
      return proxima;
    });
    expect(await esvaziarFila(buscar)).toEqual({ enviados: 1 });
    expect(await listar()).toEqual([
      expect.objectContaining({ chave: CHAVES[1], situacao: 'recusado', mensagem: 'Lote encerrado.' }),
      expect.objectContaining({ chave: CHAVES[2], situacao: 'pendente' }),
    ]);
  });

  it('manda em ordem de criação e para no primeiro sem rede', async () => {
    for (const chave of CHAVES) await guardar(chave);
    const buscar = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await esvaziarFila(buscar);
    expect(buscar).toHaveBeenCalledTimes(1);
    const [, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).chave).toBe(CHAVES[0]);
  });

  it('o recusado não é reenviado sozinho', async () => {
    await guardar(CHAVES[0]);
    await esvaziarFila(vi.fn(async () => resposta(422, { error: 'Não.' })));
    const buscar = vi.fn(async () => resposta(200, { success: 'ok' }));
    await esvaziarFila(buscar);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('duas chamadas ao mesmo tempo mandam cada registro uma vez só', async () => {
    await guardar(CHAVES[0]);
    const buscar = vi.fn(async () => resposta(200, { success: 'ok' }));
    await Promise.all([esvaziarFila(buscar), esvaziarFila(buscar), enviarGuardado({ chave: CHAVES[0], tipo: 'perda', campos: {} }, { buscar })]);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(await listar()).toEqual([]);
  });

  it('o formulário aberto tira da fila a recusa que ele mesmo mostra', async () => {
    await guardar(CHAVES[0]);
    await enviarGuardado({ chave: CHAVES[0], tipo: 'perda', campos: {} }, { recusadoSai: true, buscar: vi.fn(async () => resposta(422, { error: 'Não.' })) });
    expect(await listar()).toEqual([]);
  });

  it('sessão vencida fica pendente com o aviso, para ir depois de entrar de novo', async () => {
    await guardar(CHAVES[0]);
    await esvaziarFila(vi.fn(async () => resposta(401, { error: 'Entre de novo.' })));
    expect(await listar()).toEqual([expect.objectContaining({ situacao: 'pendente', mensagem: 'Entre de novo.' })]);
  });
});
