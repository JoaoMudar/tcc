import { describe, expect, it } from 'vitest';
import { parseFiscalFields, parsePessoaFields, papeisResumo } from '../pessoas';

function getter(values: Record<string, string>) {
  return (name: string) => values[name] ?? '';
}

const BASE = { tipo: 'pj', nome: '  Sítio   Boa Vista ', telefone: '(47) 99612-4408', papel_cliente: 'on', ativa: 'on' };

describe('parsePessoaFields (RF-14, RF-16, RF-19, RF-20)', () => {
  it('normaliza nome e telefone, e lê os papéis marcados', () => {
    const parsed = parsePessoaFields(getter({ ...BASE, papel_fornecedor: 'on' }));
    expect(parsed).toEqual({
      value: {
        tipo: 'pj',
        nome: 'Sítio Boa Vista',
        telefone: '47996124408',
        email: null,
        observacoes: null,
        ativa: true,
        papeis: [
          { papel: 'cliente', tipoVinculo: null },
          { papel: 'fornecedor', tipoVinculo: null },
        ],
        enderecos: [],
      },
    });
  });

  it('exige ao menos um papel, e vínculo no funcionário', () => {
    expect(parsePessoaFields(getter({ ...BASE, papel_cliente: '' }))).toHaveProperty('error');
    expect(parsePessoaFields(getter({ ...BASE, papel_funcionario: 'on' }))).toEqual({
      error: 'Escolha se o funcionário é fixo ou diarista.',
    });
    const diarista = parsePessoaFields(getter({ ...BASE, papel_funcionario: 'on', tipo_vinculo: 'diarista' }));
    expect(diarista).toHaveProperty('value.papeis', [
      { papel: 'cliente', tipoVinculo: null },
      { papel: 'funcionario', tipoVinculo: 'diarista' },
    ]);
  });

  it('funcionário sem telefone é aceito (RF-20: Cleusa, sem telefone, sem acesso)', () => {
    const parsed = parsePessoaFields(getter({ tipo: 'pf', nome: 'Cleusa Batista', papel_funcionario: 'on', tipo_vinculo: 'fixo' }));
    expect(parsed).toHaveProperty('value.telefone', null);
  });

  it('endereço em branco não vira linha; endereço com UF fora da lista é recusado', () => {
    const entrega = parsePessoaFields(
      getter({ ...BASE, endereco_entrega_cidade: 'Lontras', endereco_entrega_uf: 'sc', endereco_entrega_cep: '89182-000' }),
    );
    expect(entrega).toHaveProperty('value.enderecos', [
      { tipo: 'entrega', logradouro: null, cidade: 'Lontras', uf: 'SC', cep: '89182000' },
    ]);
    expect(parsePessoaFields(getter({ ...BASE, endereco_entrega_uf: 'XX' }))).toHaveProperty('error');
  });

  it('o endereço de cobrança não é lido como endereço comum', () => {
    const parsed = parsePessoaFields(getter({ ...BASE, endereco_cobranca_cidade: 'Rio do Sul' }));
    expect(parsed).toHaveProperty('value.enderecos', []);
  });

  it('recusa tipo forjado e e-mail inválido', () => {
    expect(parsePessoaFields(getter({ ...BASE, tipo: 'empresa' }))).toHaveProperty('error');
    expect(parsePessoaFields(getter({ ...BASE, email: 'sem-arroba' }))).toEqual({ error: 'E-mail inválido.' });
  });
});

describe('parseFiscalFields (RF-16, RF-17)', () => {
  it('valida o documento pelo tipo e lê o endereço de cobrança', () => {
    const parsed = parseFiscalFields(
      'pj',
      getter({ documento: '11.222.333/0001-81', endereco_cobranca_cidade: 'Rio do Sul', endereco_cobranca_uf: 'SC' }),
    );
    expect(parsed).toEqual({
      value: {
        documento: '11222333000181',
        enderecoCobranca: { tipo: 'cobranca', logradouro: null, cidade: 'Rio do Sul', uf: 'SC', cep: null },
      },
    });
  });

  it('TA-50: documento inválido é recusado', () => {
    expect(parseFiscalFields('pf', getter({ documento: '529.982.247-24' }))).toEqual({ error: 'CPF inválido. Confira os números.' });
  });

  it('documento em branco é aceito', () => {
    expect(parseFiscalFields('pf', getter({}))).toEqual({ value: { documento: null, enderecoCobranca: null } });
  });
});

describe('papeisResumo', () => {
  it('junta os papéis com o vínculo', () => {
    expect(
      papeisResumo([
        { papel: 'cliente', tipoVinculo: null },
        { papel: 'funcionario', tipoVinculo: 'fixo' },
      ]),
    ).toBe('Cliente, Funcionário fixo');
  });
});
