import { describe, expect, it } from 'vitest';
import { clientIp } from '../client-ip';

describe('clientIp', () => {
  it('fica com o último item, o que o proxy acrescentou', () => {
    expect(clientIp('1.2.3.4, 200.200.200.200', null)).toBe('200.200.200.200');
    expect(clientIp('10.0.0.1,  177.10.20.30 ', '9.9.9.9')).toBe('177.10.20.30');
  });

  it('com um item só, usa ele', () => {
    expect(clientIp('177.10.20.30', null)).toBe('177.10.20.30');
  });

  it('sem X-Forwarded-For, cai no X-Real-IP', () => {
    expect(clientIp(null, '177.10.20.30')).toBe('177.10.20.30');
    expect(clientIp(' , ', '177.10.20.30')).toBe('177.10.20.30');
  });

  it('sem nenhum dos dois, é nulo', () => {
    expect(clientIp(null, null)).toBeNull();
    expect(clientIp('', '')).toBeNull();
  });

  it('corta valor longo demais para ser endereço', () => {
    expect(clientIp('x'.repeat(500), null)).toHaveLength(45);
  });
});
