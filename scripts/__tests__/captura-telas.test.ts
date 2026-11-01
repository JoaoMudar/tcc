// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ALTURA_COMPOSICAO,
  PADRAO_CONTATO,
  PADRAO_MOEDA,
  credenciais,
  filtraTelas,
  htmlComposicao,
  montaUrl,
  origemDoBanco,
  textosSensiveis,
} from '../captura-telas-lib.mjs';
import { BANCOS, TELAS } from '../captura-telas.config.mjs';

const telas = [
  { id: 'a', banco: 'espelho' },
  { id: 'b', banco: 'dev' },
  { id: 'c', banco: 'espelho' },
];

describe('captura das telas do capítulo 5', () => {
  it('filtra pelo banco em uso e pelos ids pedidos', () => {
    expect(filtraTelas(telas, { banco: 'espelho' }).map((t) => t.id)).toEqual(['a', 'c']);
    expect(filtraTelas(telas, { banco: 'espelho', ids: ['c', 'b'] }).map((t) => t.id)).toEqual(['c']);
    expect(filtraTelas(telas)).toHaveLength(3);
  });

  it('descobre a origem pelo nome do banco e recusa banco desconhecido', () => {
    expect(origemDoBanco('postgresql://u:s@localhost:5432/viveiro_espelho', BANCOS)).toBe('espelho');
    expect(origemDoBanco('postgresql://u:s@localhost:5432/tcc', BANCOS)).toBe('dev');
    expect(() => origemDoBanco('postgresql://u:s@ep-x.neon.tech/neondb', BANCOS)).toThrow(/neondb/);
  });

  it('troca o :id da rota e exige o id quando a rota pede', () => {
    expect(montaUrl('/pedidos', undefined)).toBe('/pedidos');
    expect(montaUrl('/pedidos/planejar/:id', '2026-10-15')).toBe('/pedidos/planejar/2026-10-15');
    expect(() => montaUrl('/pedidos/:id', undefined)).toThrow(/não devolveu linha/);
  });

  it('junta nome, telefone e documento de cliente, sem repetir nem pegar texto curto', () => {
    const textos = textosSensiveis([
      { nome: 'Prefeitura de Rio do Sul', telefone: '47 99999-0000', documento: null },
      { nome: 'Prefeitura de Rio do Sul', telefone: '', documento: '123' },
    ]);
    expect(textos).toEqual(['Prefeitura de Rio do Sul', '47 99999-0000']);
  });

  it('reconhece valor em reais como o app formata', () => {
    const moeda = new RegExp(PADRAO_MOEDA);
    expect(moeda.test('R$ 1.234,50')).toBe(true);
    expect(moeda.test(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(12))).toBe(true);
    expect(moeda.test('1.234 mudas')).toBe(false);
  });

  it('reconhece telefone, documento e CEP como a tela escreve, sem pegar data nem quantidade', () => {
    const contato = new RegExp(PADRAO_CONTATO);
    for (const t of ['(47) 99192-2010', '47 3521-0000', '47991922010', '123.456.789-00', '12.345.678/0001-90', 'Jaraguá do Sul - SC, 89253-740']) {
      expect(contato.test(t), t).toBe(true);
    }
    for (const t of ['14/10/2026 16:51', '1.234 mudas', '11/11', '0,50 m', 'Saco 10x18', 'Pedido 130']) {
      expect(contato.test(t), t).toBe(false);
    }
  });

  it('considera toda coluna da linha, inclusive endereço', () => {
    expect(textosSensiveis([{ logradouro: 'Rua das Flores, 10', email: null, cep: '' }])).toEqual(['Rua das Flores, 10']);
  });

  it('lê credenciais do perfil e avisa o nome da variável que falta', () => {
    const env = { CAPTURA_LOGIN_CHEFIA: 'gilberto', CAPTURA_SENHA_CHEFIA: 'x' };
    expect(credenciais('chefia', env)).toEqual({ login: 'gilberto', senha: 'x' });
    expect(() => credenciais('gerencia', env)).toThrow(/CAPTURA_LOGIN_GERENCIA/);
  });

  it('põe desktop e celular na mesma altura, nessa ordem', () => {
    const html = htmlComposicao(Buffer.from('D'), Buffer.from('C'));
    expect(html).toContain(`height: ${ALTURA_COMPOSICAO}px`);
    expect(html.indexOf('class="desktop"')).toBeLessThan(html.indexOf('class="celular"'));
    expect(html).toContain(`base64,${Buffer.from('D').toString('base64')}`);
  });

  it('cada tela da lista tem id único, banco conhecido e consulta quando a rota tem :id', () => {
    const ids = TELAS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tela of TELAS) {
      expect(Object.keys(BANCOS)).toContain(tela.banco);
      expect(Boolean(tela.sql)).toBe(tela.url.includes(':id'));
    }
  });
});
