// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  idFicticio,
  lotesComSaldoDivergente,
  motivoDaRecusa,
  motivoParaNaoMexer,
  PREFIXO_FICTICIO,
  segundaDaSemana,
  situacoesDivergentes,
  somaDias,
} from '../carga-ficticia-lib.mjs';

describe('trava da carga fictícia', () => {
  it('aceita só o espelho local', () => {
    expect(motivoDaRecusa('postgresql://postgres:x@localhost:5432/viveiro_espelho')).toBeNull();
    expect(motivoDaRecusa('postgresql://postgres:x@127.0.0.1:5432/viveiro_espelho')).toBeNull();
  });

  it('recusa o Neon, mesmo com o nome do banco certo', () => {
    expect(motivoDaRecusa('postgresql://u:x@ep-blue.sa-east-1.aws.neon.tech/viveiro_espelho?sslmode=require')).toMatch(/não é local/);
    expect(motivoDaRecusa('postgresql://u:x@ep-blue.sa-east-1.aws.neon.tech/neondb')).toMatch(/não é local/);
  });

  it('recusa outro banco local, url inválida e variável vazia', () => {
    expect(motivoDaRecusa('postgresql://postgres:x@localhost:5432/tcc')).toMatch(/tcc/);
    expect(motivoDaRecusa('nao e url')).toMatch(/inválida/);
    expect(motivoDaRecusa(undefined)).toMatch(/não definida/);
  });

  it('não mexe em produção sem a marca da carga', () => {
    expect(motivoParaNaoMexer({ producao: 3, ficticias: 0 })).toMatch(/3 registro/);
    expect(motivoParaNaoMexer({ producao: 0, ficticias: 0 })).toBeNull();
    expect(motivoParaNaoMexer({ producao: 3, ficticias: 6 })).toBeNull();
  });

  it('marca o id das pessoas com o prefixo, num uuid válido', () => {
    expect(idFicticio(7)).toBe(`${PREFIXO_FICTICIO}000000000007`);
    expect(idFicticio(7)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('datas da carga', () => {
  it('soma dias atravessando o mês e o ano', () => {
    expect(somaDias('2026-11-01', -1)).toBe('2026-10-31');
    expect(somaDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('o domingo pertence à semana que termina nele', () => {
    expect(segundaDaSemana('2026-11-01')).toBe('2026-10-26');
    expect(segundaDaSemana('2026-11-02')).toBe('2026-11-02');
    expect(segundaDaSemana('2026-10-28')).toBe('2026-10-26');
  });
});

describe('conferência no fim da carga', () => {
  it('aponta o lote cuja soma dos movimentos não dá o saldo', () => {
    expect(
      lotesComSaldoDivergente([
        { codigo: '2026-0001', saldo: 10, soma: '10' },
        { codigo: '2026-0002', saldo: 5, soma: '7' },
      ]),
    ).toEqual(['2026-0002']);
  });

  it('aponta a situação diferente da esperada e o lote que a visão não trouxe', () => {
    const esperadas = [
      { codigo: 'a', nome: 'Pitanga', situacao: 'saudavel' },
      { codigo: 'b', nome: 'Ingá', situacao: 'critico' },
      { codigo: 'c', nome: 'Cedro', situacao: 'atencao' },
    ];
    const obtidas = [
      { codigo: 'a', situacao: 'saudavel' },
      { codigo: 'b', situacao: 'atencao' },
    ];
    expect(situacoesDivergentes(esperadas, obtidas)).toEqual([
      'b (Ingá): esperava critico, a visão diz atencao',
      'c (Cedro): esperava atencao, a visão diz nada',
    ]);
  });
});
