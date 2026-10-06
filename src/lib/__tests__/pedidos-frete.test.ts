import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../rotas-ors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../rotas-ors')>()),
  geocodificarTexto: vi.fn(),
  distanciaDeCarro: vi.fn(),
}));

const { distanciaDeCarro, geocodificarTexto } = await import('../rotas-ors');
const { sugestaoDeFrete } = await import('../pedidos-frete');

const PEDIDO = '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d0e';

/**
 * P19: o frete vai até o destino do pedido. O que se confere aqui é onde a
 * coordenada achada fica: no pedido, quando o destino é dele, e no cadastro do
 * cliente, quando o pedido usa o do cliente.
 */
function banco(destino: Record<string, unknown>) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('FROM pedidos p')) {
      return {
        rows: [{ situacao: 'verificado', numero: 1, lat: null, lng: null, geocodificadoEm: null, ...destino }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM parametros')) {
      const rows = [
        { chave: 'comercial.frete_km_por_litro', valor: '17' },
        { chave: 'comercial.frete_preco_litro', valor: '7' },
      ];
      return { rows, rowCount: rows.length };
    }
    return { rows: [], rowCount: 1 };
  });
  return { query };
}

function sqls(db: ReturnType<typeof banco>) {
  return db.query.mock.calls.map(([sql]) => String(sql));
}

describe('sugestaoDeFrete: o destino do pedido (P19)', () => {
  beforeEach(() => {
    vi.mocked(geocodificarTexto).mockReset().mockResolvedValue({ lat: -27.2, lng: -49.6 });
    vi.mocked(distanciaDeCarro).mockReset().mockResolvedValue(42_000);
  });

  it('o destino próprio é o procurado, e a coordenada fica no pedido', async () => {
    const db = banco({ proprio: true, enderecoId: null, logradouro: 'Sítio Novo', cidade: 'Ituporanga', uf: 'SC' });
    const sugestao = await sugestaoDeFrete(db as never, PEDIDO, 'agrolandia');
    expect(sugestao).toMatchObject({ distanciaKm: 42 });
    expect(vi.mocked(geocodificarTexto).mock.calls[0][0]).toBe('Sítio Novo, Ituporanga, SC');
    expect(sqls(db).some((sql) => sql.includes('SET entrega_lat'))).toBe(true);
    expect(sqls(db).some((sql) => sql.includes('UPDATE cadastro.pessoas_enderecos'))).toBe(false);
  });

  it('sem destino próprio, vale o do cliente, e a coordenada volta para o cadastro', async () => {
    const db = banco({ proprio: false, enderecoId: 'e1', logradouro: 'Rua XV', cidade: 'Rio do Sul', uf: 'SC' });
    await sugestaoDeFrete(db as never, PEDIDO, 'agrolandia');
    expect(sqls(db).some((sql) => sql.includes('UPDATE cadastro.pessoas_enderecos'))).toBe(true);
    expect(sqls(db).some((sql) => sql.includes('SET entrega_lat'))).toBe(false);
  });

  it('nem do pedido nem do cliente: avisa sem consultar o mapa', async () => {
    const db = banco({ proprio: null, enderecoId: null, logradouro: null, cidade: null, uf: null });
    await expect(sugestaoDeFrete(db as never, PEDIDO, 'agrolandia')).resolves.toEqual({ aviso: 'sem_endereco', endereco: null });
    expect(geocodificarTexto).not.toHaveBeenCalled();
  });
});
