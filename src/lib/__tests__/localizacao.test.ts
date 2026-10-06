// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ehDestinoDoMaps, lerLocalizacao, linkCurto, linkDoPonto, pontoEmTexto } from '../localizacao';
import { resolverLocalizacao } from '../localizacao-servidor';

const PONTO = { lat: -27.214123, lng: -49.643123 };

describe('lerLocalizacao: os formatos que o WhatsApp manda (P17)', () => {
  it.each([
    ['o par colado', '-27.214123, -49.643123'],
    ['o par com ponto e vírgula', '-27.214123;-49.643123'],
    ['Android, link do Google Maps', 'https://maps.google.com/maps?q=-27.214123%2C-49.643123&z=17&hl=pt-BR'],
    ['Android, com texto antes', 'Localização: https://maps.google.com/?q=-27.214123,-49.643123'],
    ['link longo com @', 'https://www.google.com/maps/@-27.214123,-49.643123,17z'],
    ['link de lugar', 'https://www.google.com/maps/place/Viveiro/@-27.2,-49.6,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-27.214123!4d-49.643123'],
    ['link de busca', 'https://www.google.com/maps/search/?api=1&query=-27.214123,-49.643123'],
    ['iPhone, Apple Maps', 'https://maps.apple.com/?ll=-27.214123,-49.643123&q=Localiza%C3%A7%C3%A3o'],
    ['geo:', 'geo:-27.214123,-49.643123?z=17'],
  ])('%s', (_, texto) => {
    expect(lerLocalizacao(texto)).toEqual(PONTO);
  });

  it('o lugar do link vale mais que o centro do mapa', () => {
    const lugar = lerLocalizacao('https://www.google.com/maps/place/X/@-27.0,-49.0,15z/data=!3d-27.214123!4d-49.643123');
    expect(lugar).toEqual(PONTO);
  });

  it('texto sem ponto, ponto fora do mapa e (0, 0) não valem', () => {
    expect(lerLocalizacao('Rua XV de Novembro, 120')).toBeNull();
    expect(lerLocalizacao('https://maps.google.com/?q=Rio+do+Sul')).toBeNull();
    expect(lerLocalizacao('-127.2, -49.6')).toBeNull();
    expect(lerLocalizacao('0, 0')).toBeNull();
    expect(lerLocalizacao('')).toBeNull();
  });

  it('o link curto não se lê sem rede', () => {
    expect(lerLocalizacao('https://maps.app.goo.gl/AbC123')).toBeNull();
    expect(linkCurto('https://maps.app.goo.gl/AbC123')?.hostname).toBe('maps.app.goo.gl');
    expect(linkCurto('https://goo.gl/maps/AbC123')?.hostname).toBe('goo.gl');
  });

  it('só o encurtador do Maps é link curto', () => {
    expect(linkCurto('https://bit.ly/xyz')).toBeNull();
    expect(linkCurto('http://maps.app.goo.gl/AbC123')).toBeNull();
    expect(linkCurto('https://goo.gl/outra-coisa')).toBeNull();
    expect(ehDestinoDoMaps(new URL('https://www.google.com/maps/place/x'))).toBe(true);
    expect(ehDestinoDoMaps(new URL('https://maps.google.com.br/?q=1'))).toBe(true);
    expect(ehDestinoDoMaps(new URL('http://169.254.169.254/latest'))).toBe(false);
    expect(ehDestinoDoMaps(new URL('https://google.com.evil.example/'))).toBe(false);
  });

  it('o ponto em texto e o link para conferir', () => {
    expect(pontoEmTexto(PONTO)).toBe('-27.214123, -49.643123');
    expect(linkDoPonto(PONTO)).toBe('https://www.google.com/maps/search/?api=1&query=-27.214123,-49.643123');
  });
});

describe('resolverLocalizacao: o link curto, seguido no servidor', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  function redireciona(para: string) {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: para } }));
  }

  it('segue o redirecionamento até o link com o ponto', async () => {
    redireciona('https://www.google.com/maps/place/X/@-27.214123,-49.643123,17z');
    await expect(resolverLocalizacao('https://maps.app.goo.gl/AbC123')).resolves.toEqual(PONTO);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('o ponto que se lê sem rede não consulta nada', async () => {
    await expect(resolverLocalizacao('-27.214123, -49.643123')).resolves.toEqual(PONTO);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirecionamento para fora do Maps é abandonado', async () => {
    redireciona('http://10.0.0.1/admin');
    await expect(resolverLocalizacao('https://maps.app.goo.gl/AbC123')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('link de outro domínio nem é buscado', async () => {
    await expect(resolverLocalizacao('https://exemplo.com/mapa')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no máximo três saltos', async () => {
    for (let i = 0; i < 5; i++) redireciona(`https://maps.app.goo.gl/salto${i}`);
    await expect(resolverLocalizacao('https://maps.app.goo.gl/AbC123')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
