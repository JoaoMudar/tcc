import { describe, expect, it, vi } from 'vitest';
import { avisoDoPedido, listInscricoesPorPerfis, parseInscricao, salvarInscricao } from '../notificacoes';
import { chaveEmBytes } from '../push-navegador';

describe('avisoDoPedido', () => {
  it('o pedido cadastrado vai para a gerência verificar', () => {
    expect(avisoDoPedido('cadastrado', 'Prefeitura de Rio do Sul')).toEqual({
      titulo: expect.any(String),
      corpo: 'Pedido de Prefeitura de Rio do Sul foi liberado para verificação!',
      perfis: ['gerencia'],
    });
  });

  it('o verificado vai para a chefia e o admin finalizarem', () => {
    const aviso = avisoDoPedido('verificado', ' Maria ');
    expect(aviso?.corpo).toBe('Pedido de Maria foi liberado para finalização!');
    expect(aviso?.perfis).toEqual(['admin', 'chefia']);
  });

  it('o aprovado vai para a gerência separar', () => {
    const aviso = avisoDoPedido('aprovado', 'João');
    expect(aviso?.corpo).toBe('Pedido de João foi liberado para separação!');
    expect(aviso?.perfis).toEqual(['gerencia']);
  });

  it('as outras mudanças não passam o pedido de mão, e não avisam', () => {
    for (const situacao of ['verificando', 'pendente_alteracao', 'separando', 'pronto_envio', 'cancelado'] as const) {
      expect(avisoDoPedido(situacao, 'X')).toBeNull();
    }
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
