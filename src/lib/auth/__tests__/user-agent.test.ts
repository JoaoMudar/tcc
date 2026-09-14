import { describe, expect, it } from 'vitest';
import { describeUserAgent } from '../user-agent';

describe('describeUserAgent', () => {
  it.each([
    [
      'Chrome, Android',
      'Mozilla/5.0 (Linux; Android 14; moto g54 5G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
    ],
    [
      'Samsung Internet, Android',
      'Mozilla/5.0 (Linux; Android 13; SM-A155M) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    ],
    [
      'Safari, iPhone',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    ],
    [
      'Chrome, Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    ],
    [
      'Edge, Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
    ],
    ['Firefox, Linux', 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'],
    ['Safari, Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'],
  ])('reconhece %s', (esperado, userAgent) => {
    expect(describeUserAgent(userAgent)).toBe(esperado);
  });

  it('sem user agent, ou desconhecido', () => {
    expect(describeUserAgent(null)).toBe('Aparelho desconhecido');
    expect(describeUserAgent('curl/8.0')).toBe('Navegador');
  });
});
