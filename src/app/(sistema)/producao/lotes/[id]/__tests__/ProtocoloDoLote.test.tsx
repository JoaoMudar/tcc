import { describe, expect, it } from 'vitest';
import type { AcaoDaEtapa } from '@/lib/protocolos';
import { textoPostergada } from '../ProtocoloDoLote';

const ADIAMENTO: AcaoDaEtapa = {
  id: 'ac1',
  rotulo: 'Limpeza',
  tipoAcao: 'adiamento',
  dias: 37,
  diasEscolhidos: 15,
  dataAcao: '2026-10-30',
  registradoPor: 'Débora',
};

describe('ProtocoloDoLote, histórico do adiamento (TA-82)', () => {
  it('mostra os dias escolhidos, e não o deslocamento com o atraso', () => {
    expect(textoPostergada(ADIAMENTO)).toBe('postergada 15 dias');
  });

  it('a linha antiga, sem os dias escolhidos, mostra o que tem', () => {
    expect(textoPostergada({ dias: 1, diasEscolhidos: null })).toBe('postergada 1 dia');
  });
});
