import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARQUIVOS, lerCsv } from '../carga-inicial';

describe('lerCsv (T10.5)', () => {
  it('lê o CSV do Excel em português: ponto e vírgula, marca de bytes e aspas', () => {
    const texto = '﻿nome_cientifico;nomes_populares;observacoes\r\nEugenia uniflora;"Pitangueira, Pitanga";"diz ""pitanga"""\r\n';
    const lido = lerCsv(texto, 'especies');
    expect(lido).toEqual({
      value: [
        {
          __linha: 'especies.csv linha 2',
          nome_cientifico: 'Eugenia uniflora',
          nomes_populares: 'Pitangueira, Pitanga',
          observacoes: 'diz "pitanga"',
        },
      ],
    });
  });

  it('pula linha em branco e comentário, e conta a linha do arquivo para o erro', () => {
    const lido = lerCsv('# modelo\nnome;volume_litros\n\n# Tubete;0,055\nBalde;12\n', 'recipientes');
    expect(lido).toEqual({ value: [{ __linha: 'recipientes.csv linha 5', nome: 'Balde', volume_litros: '12' }] });
  });

  it('recusa a planilha sem a coluna esperada', () => {
    expect(lerCsv('nome,volume_litros\nBalde,12', 'recipientes')).toEqual({
      error: 'recipientes.csv: falta a coluna nome, volume_litros no cabeçalho (separe por ponto e vírgula).',
    });
  });

  it('os modelos do repositório são lidos sem erro', () => {
    for (const arquivo of ARQUIVOS) {
      const texto = readFileSync(path.join(process.cwd(), 'scripts/carga-inicial-modelo', `${arquivo}.csv`), 'utf8');
      expect(lerCsv(texto, arquivo)).not.toHaveProperty('error');
    }
  });
});
