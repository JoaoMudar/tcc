import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { type Arquivo, type Linha, importarCarga, lerCsv } from '../carga-inicial';

/** T10.5 contra Postgres real: grava pelas funções da tela, pula o que existe, e acusa linha errada. */

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const p = `tc${randomUUID().slice(0, 6)}`;

function csv(arquivo: Arquivo, texto: string): Linha[] {
  const lido = lerCsv(texto, arquivo);
  if ('error' in lido) throw new Error(lido.error);
  return lido.value;
}

const carga = () => ({
  recipientes: csv('recipientes', `nome;volume_litros\n${p} Tubete;0,055\n${p} Balde;`),
  canteiros: csv('canteiros', 'area;nome_area;canteiro;capacidade\nK;Carga;1;5000\nK;;2;'),
  especies: csv('especies', `nome_cientifico;nomes_populares;observacoes\n${p} Eugenia;${p} Pitangueira, ${p} Pitanga;`),
  funcionarios: csv('funcionarios', `nome;telefone;vinculo\n${p} Rogério;(47) 99612-4408;fixo\n${p} Diarista;;diarista`),
});

async function naTransacao<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await fn(client);
    await client.query('COMMIT');
    return r;
  } finally {
    client.release();
  }
}

afterAll(async () => {
  await pool.end();
});

describe('importarCarga (T10.5)', () => {
  it('grava tudo na primeira vez e pula tudo na segunda', async () => {
    const primeira = await naTransacao((c) => importarCarga(c, carga()));
    expect(primeira.erros).toEqual([]);
    expect(primeira.criados).toEqual({ recipientes: 2, canteiros: 2, especies: 1, funcionarios: 2 });

    const segunda = await naTransacao((c) => importarCarga(c, carga()));
    expect(segunda.criados).toEqual({ recipientes: 0, canteiros: 0, especies: 0, funcionarios: 0 });
    expect(segunda.pulados).toEqual({ recipientes: 2, canteiros: 2, especies: 1, funcionarios: 2 });

    const nomes = await pool.query(
      `SELECT n.nome, n.e_principal FROM especies_nomes_populares n JOIN especies e ON e.id = n.especie_id
        WHERE e.nome_cientifico = $1 ORDER BY n.e_principal DESC`,
      [`${p} Eugenia`],
    );
    expect(nomes.rows).toEqual([
      { nome: `${p} Pitangueira`, e_principal: true },
      { nome: `${p} Pitanga`, e_principal: false },
    ]);

    const papel = await pool.query(
      `SELECT pp.tipo_vinculo, pe.telefone FROM cadastro.pessoas pe JOIN cadastro.pessoas_papeis pp ON pp.pessoa_id = pe.id
        WHERE pe.nome = $1 AND pp.papel = 'funcionario'`,
      [`${p} Rogério`],
    );
    expect(papel.rows).toEqual([{ tipo_vinculo: 'fixo', telefone: '47996124408' }]);
  });

  it('aponta arquivo e linha do que está errado', async () => {
    const r = await naTransacao((c) =>
      importarCarga(c, {
        canteiros: csv('canteiros', 'area;nome_area;canteiro;capacidade\nKK;;1;'),
        funcionarios: csv('funcionarios', `nome;telefone;vinculo\n${p} Sem vínculo;;temporario`),
      }),
    );
    expect(r.erros).toEqual([
      'canteiros.csv linha 2: A área é identificada por uma letra, de A a Z.',
      'funcionarios.csv linha 2: O vínculo é "fixo" ou "diarista".',
    ]);
  });
});
