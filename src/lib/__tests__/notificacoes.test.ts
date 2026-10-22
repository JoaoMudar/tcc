import { describe, expect, it, vi } from 'vitest';
import { avisoDeData, avisoDoPedido, listInscricoesPorPerfis, parseInscricao, salvarInscricao } from '../notificacoes';
import { chaveEmBytes } from '../push-navegador';

describe('avisoDoPedido', () => {
  it('o pedido cadastrado vai para a gerência verificar', () => {
    expect(avisoDoPedido('cadastrado', 'Prefeitura de Rio do Sul', null)).toEqual({
      titulo: 'Pedido novo!',
      corpo: 'Prefeitura de Rio do Sul está aguardando verificação.',
      perfis: ['gerencia'],
    });
  });

  it('o verificado vai para a chefia e o admin finalizarem', () => {
    const aviso = avisoDoPedido('verificado', ' Maria ', null);
    expect(aviso?.titulo).toBe('Conferência feita!');
    expect(aviso?.corpo).toBe('Maria está aguardando finalização.');
    expect(aviso?.perfis).toEqual(['admin', 'chefia']);
  });

  it('o aprovado vai para a gerência, com a data quando houver', () => {
    expect(avisoDoPedido('aprovado', 'João', '2026-10-20')?.corpo).toBe('Pedido aprovado para dia 20/10/2026 de João!');
    const semData = avisoDoPedido('aprovado', 'João', null);
    expect(semData?.corpo).toBe('Pedido aprovado de João!');
    expect(semData?.perfis).toEqual(['gerencia']);
  });

  it('as outras mudanças não passam o pedido de mão, e não avisam', () => {
    for (const situacao of ['verificando', 'pendente_alteracao', 'separando', 'pronto_envio', 'cancelado'] as const) {
      expect(avisoDoPedido(situacao, 'X', null)).toBeNull();
    }
  });
});

describe('avisoDeData', () => {
  it('data trocada diz a antiga e a nova, para a gerência', () => {
    expect(avisoDeData('João', '2026-10-18', '2026-10-20')).toEqual({
      titulo: 'Data de entrega alterada',
      corpo: 'Pedido de João trocou de data de 18/10/2026 para 20/10/2026.',
      perfis: ['gerencia'],
    });
  });

  it('pedido sem data que ganha uma', () => {
    expect(avisoDeData('João', null, '2026-10-20')?.corpo).toBe('Pedido de João teve data marcada para 20/10/2026.');
  });

  it('data igual ou apagada não avisa', () => {
    expect(avisoDeData('João', '2026-10-20', '2026-10-20')).toBeNull();
    expect(avisoDeData('João', '2026-10-20', null)).toBeNull();
  });
});

describe('parseInscricao', () => {
  const valida = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BEl6', auth: 'k8J' } };

  it('aceita o que o navegador devolve', () => {
    expect(parseInscricao(valida)).toEqual({ endpoint: valida.endpoint, p256dh: 'BEl6', auth: 'k8J' });
  });

  it('recusa endpoint fora de https, chave faltando e lixo', () => {
    expect(parseInscricao({ ...valida, endpoint: 'http://x' })).toBeNull();
    expect(parseInscricao({ ...valida, keys: { p256dh: 'a' } })).toBeNull();
    expect(parseInscricao({ ...valida, keys: { p256dh: '', auth: 'b' } })).toBeNull();
    expect(parseInscricao('texto')).toBeNull();
    expect(parseInscricao(null)).toBeNull();
    expect(parseInscricao({ ...valida, endpoint: `https://${'a'.repeat(3000)}` })).toBeNull();
  });
});

describe('SQL das inscrições', () => {
  it('o aparelho reinscrito troca de dono em vez de duplicar', async () => {
    const db = { query: vi.fn<(sql: string, params?: unknown[]) => Promise<{ rows: never[] }>>(async () => ({ rows: [] })) };
    await salvarInscricao(db as never, 'u1', { endpoint: 'https://e', p256dh: 'p', auth: 'a' });
    expect(String(db.query.mock.calls[0][0])).toMatch(/ON CONFLICT \(endpoint\) DO UPDATE/);
  });

  it('busca só usuário ativo do perfil, sem o autor da mudança', async () => {
    const db = { query: vi.fn<(sql: string, params?: unknown[]) => Promise<{ rows: never[] }>>(async () => ({ rows: [] })) };
    await listInscricoesPorPerfis(db as never, ['gerencia'], 'u1');
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/u\.ativo/);
    expect(params).toEqual([['gerencia'], 'u1']);
  });
});

describe('chaveEmBytes', () => {
  it('decodifica base64 de URL, sem preenchimento', () => {
    expect(Array.from(chaveEmBytes('-_8'))).toEqual([0xfb, 0xff]);
  });
});
