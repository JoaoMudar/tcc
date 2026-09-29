import { describe, expect, it } from 'vitest';
import {
  aplicarOrdemSugerida,
  enderecoEmTexto,
  formatDiaDaViagem,
  lerCoordenada,
  formatDistancia,
  isAvisoDaRota,
  isSituacaoViagem,
  linkGoogleMaps,
  moverNaLista,
  ordemDeCarregamento,
  resumoDoItem,
} from '../rotas';

const VIVEIRO = { lat: -27.408, lng: -49.822, endereco: 'Agrolândia, SC' };

function ponto(n: number) {
  return { lat: -27 - n / 100, lng: -49 - n / 100, endereco: `Rua ${n}` };
}

/** Os parâmetros do link, lidos como o Google os lê. */
function parametros(url: string) {
  return new URL(url).searchParams;
}

describe('resumoDoItem', () => {
  it('concatena espécie, quantidade e altura', () => {
    expect(resumoDoItem({ especie: 'Ipê-amarelo', quantidade: 300, alturaM: 1.2 })).toBe('Ipê-amarelo · 300 · 1,20 m');
  });

  it('separa o milhar e omite o que o item não tem', () => {
    expect(resumoDoItem({ especie: 'Cedro', quantidade: 1500, alturaM: null })).toBe('Cedro · 1.500');
    expect(resumoDoItem({ especie: 'Araçá', quantidade: null, alturaM: 0.8 })).toBe('Araçá · 0,80 m');
  });
});

describe('enderecoEmTexto', () => {
  it('junta o que existe, sem vírgula sobrando', () => {
    expect(enderecoEmTexto({ logradouro: 'Rua XV, 12', cidade: 'Rio do Sul', uf: 'SC' })).toBe('Rua XV, 12, Rio do Sul, SC');
    expect(enderecoEmTexto({ logradouro: ' ', cidade: 'Ibirama', uf: null })).toBe('Ibirama');
    expect(enderecoEmTexto({ logradouro: null, cidade: null, uf: null })).toBeNull();
  });
});

describe('ordemDeCarregamento', () => {
  it('é a rota ao contrário: a última entrega vai primeiro, para o fundo', () => {
    const paradas = [
      { id: 'a', pedidoId: 'p1' },
      { id: 'b', pedidoId: 'p2' },
      { id: 'c', pedidoId: 'p3' },
    ];
    expect(ordemDeCarregamento(paradas).map((p) => p.id)).toEqual(['c', 'b', 'a']);
  });

  it('deixa de fora a parada avulsa, que não tem item', () => {
    const paradas = [
      { id: 'a', pedidoId: 'p1' },
      { id: 'x', pedidoId: null },
      { id: 'b', pedidoId: 'p2' },
    ];
    expect(ordemDeCarregamento(paradas).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('não altera a lista recebida', () => {
    const paradas = [{ pedidoId: 'p1' }, { pedidoId: 'p2' }];
    ordemDeCarregamento(paradas);
    expect(paradas.map((p) => p.pedidoId)).toEqual(['p1', 'p2']);
  });
});

describe('linkGoogleMaps', () => {
  it('segue a ordem da tela, com a última parada como destino', () => {
    const [link] = linkGoogleMaps(VIVEIRO, [ponto(1), ponto(2), ponto(3)]);
    const busca = parametros(link);
    expect(link.startsWith('https://www.google.com/maps/dir/?')).toBe(true);
    expect(busca.get('api')).toBe('1');
    expect(busca.get('origin')).toBe('-27.408,-49.822');
    expect(busca.get('waypoints')).toBe('-27.01,-49.01|-27.02,-49.02');
    expect(busca.get('destination')).toBe('-27.03,-49.03');
    expect(busca.get('travelmode')).toBe('driving');
  });

  it('usa o endereço em texto quando não há coordenada', () => {
    const [link] = linkGoogleMaps({ lat: null, lng: null, endereco: 'Itapema, SC' }, [
      { lat: null, lng: null, endereco: 'Rua XV, Rio do Sul' },
    ]);
    expect(parametros(link).get('origin')).toBe('Itapema, SC');
    expect(parametros(link).get('destination')).toBe('Rua XV, Rio do Sul');
    expect(parametros(link).has('waypoints')).toBe(false);
  });

  it('deixa de fora o ponto sem endereço', () => {
    const [link] = linkGoogleMaps(VIVEIRO, [ponto(1), { lat: null, lng: null, endereco: null }, ponto(2)]);
    expect(parametros(link).get('waypoints')).toBe('-27.01,-49.01');
    expect(parametros(link).get('destination')).toBe('-27.02,-49.02');
  });

  it('sem nenhum ponto com endereço, não há link', () => {
    expect(linkGoogleMaps(VIVEIRO, [{ lat: null, lng: null, endereco: '  ' }])).toEqual([]);
  });

  it('até 10 paradas cabem em um link', () => {
    const paradas = Array.from({ length: 10 }, (_, i) => ponto(i + 1));
    const links = linkGoogleMaps(VIVEIRO, paradas);
    expect(links).toHaveLength(1);
    expect(parametros(links[0]).get('waypoints')!.split('|')).toHaveLength(9);
  });

  it('acima de 10, o segundo link parte da 10ª parada', () => {
    const paradas = Array.from({ length: 13 }, (_, i) => ponto(i + 1));
    const links = linkGoogleMaps(VIVEIRO, paradas);
    expect(links).toHaveLength(2);
    expect(parametros(links[0]).get('destination')).toBe('-27.1,-49.1');
    expect(parametros(links[1]).get('origin')).toBe('-27.1,-49.1');
    expect(parametros(links[1]).get('waypoints')).toBe('-27.11,-49.11|-27.12,-49.12');
    expect(parametros(links[1]).get('destination')).toBe('-27.13,-49.13');
  });
});

describe('aplicarOrdemSugerida', () => {
  it('põe primeiro o que a API ordenou, e o resto no fim, na ordem em que estava', () => {
    expect(aplicarOrdemSugerida(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignora id que não é parada da viagem', () => {
    expect(aplicarOrdemSugerida(['a', 'b'], ['z', 'b'])).toEqual(['b', 'a']);
  });
});

describe('moverNaLista', () => {
  it('move o item para a posição de destino', () => {
    expect(moverNaLista(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moverNaLista(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('fora da lista, não muda nada', () => {
    expect(moverNaLista(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moverNaLista(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
  });
});

describe('formatos', () => {
  it('distância em km e tempo em horas e minutos', () => {
    expect(formatDistancia(42_300, 3900)).toBe('cerca de 42 km · 1 h 05 min');
    expect(formatDistancia(900, 720)).toBe('cerca de 900 m · 12 min');
    expect(formatDistancia(15_000, null)).toBe('cerca de 15 km');
  });

  it('o dia da viagem com o dia da semana', () => {
    expect(formatDiaDaViagem('2026-10-02')).toBe('sexta, 02/10');
    expect(formatDiaDaViagem('2026-10-04')).toBe('domingo, 04/10');
  });

  it('situação e aviso só aceitam os valores conhecidos', () => {
    expect(isSituacaoViagem('roteirizando')).toBe(true);
    expect(isSituacaoViagem('entregue')).toBe(false);
    expect(isAvisoDaRota('mapa_indisponivel')).toBe(true);
    expect(isAvisoDaRota('<script>')).toBe(false);
    expect(isAvisoDaRota(undefined)).toBe(false);
  });
});

describe('lerCoordenada', () => {
  it('lê a coordenada da sugestão escolhida', () => {
    expect(lerCoordenada('-27.2', '-49.6')).toEqual({ lat: -27.2, lng: -49.6 });
  });

  it('vazio ou fora do mapa vale como ausente', () => {
    expect(lerCoordenada('', '')).toBeNull();
    expect(lerCoordenada('-27.2', '')).toBeNull();
    expect(lerCoordenada('abc', '-49.6')).toBeNull();
    expect(lerCoordenada('95', '-49.6')).toBeNull();
  });
});
