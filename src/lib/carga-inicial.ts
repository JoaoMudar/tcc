import type { PoolClient } from 'pg';
import { insertArea, insertCanteiro, parseCapacidade, parseLetra, parseNomeArea, parseNumeroCanteiro } from './areas';
import { validateTelefone } from './documento';
import { parseEspecieFields, saveEspecie } from './especies';
import { savePessoa } from './pessoas';
import { insertRecipiente, parseRecipienteFields } from './recipientes';

/**
 * T10.5: a carga inicial real, lida de planilhas salvas em CSV. Cada linha passa
 * pela mesma validação da tela (os `parse*` de cada cadastro) e é gravada pelas
 * mesmas funções: a carga não é um caminho de escrita paralelo.
 *
 * Tudo ou nada: com um erro em qualquer linha, nada é gravado, e o relatório
 * aponta arquivo e linha. Idempotente: o que já existe é pulado, e rodar de novo
 * depois de corrigir uma planilha não duplica o resto.
 */

export type Arquivo = 'especies' | 'recipientes' | 'canteiros' | 'funcionarios';
export const ARQUIVOS: readonly Arquivo[] = ['recipientes', 'canteiros', 'especies', 'funcionarios'];

/** Cabeçalho esperado de cada planilha, na ordem das colunas. */
export const COLUNAS: Record<Arquivo, readonly string[]> = {
  especies: ['nome_cientifico', 'nomes_populares', 'observacoes'],
  recipientes: ['nome', 'volume_litros'],
  canteiros: ['area', 'nome_area', 'canteiro', 'capacidade'],
  funcionarios: ['nome', 'telefone', 'vinculo'],
};

export type Linha = Record<string, string> & { __linha: string };

/**
 * CSV separado por ponto e vírgula, que é o que o Excel em português salva.
 * Aceita aspas, a marca de ordem de bytes do Excel, linha em branco e linha
 * começada por `#` (comentário do modelo).
 */
export function lerCsv(texto: string, arquivo: Arquivo): { error: string } | { value: Linha[] } {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const celulas = (linha: string) => {
    const saida: string[] = [];
    let atual = '';
    let aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"' && aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') aspas = !aspas;
      else if (c === ';' && !aspas) {
        saida.push(atual.trim());
        atual = '';
      } else atual += c;
    }
    saida.push(atual.trim());
    return saida;
  };

  let cabecalho: string[] | null = null;
  const resultado: Linha[] = [];
  for (const [i, bruta] of linhas.entries()) {
    if (bruta.trim() === '' || bruta.trimStart().startsWith('#')) continue;
    const valores = celulas(bruta);
    if (!cabecalho) {
      cabecalho = valores.map((v) => v.toLowerCase());
      const faltam = COLUNAS[arquivo].filter((c) => !cabecalho!.includes(c));
      if (faltam.length > 0) return { error: `${arquivo}.csv: falta a coluna ${faltam.join(', ')} no cabeçalho (separe por ponto e vírgula).` };
      continue;
    }
    const linha = { __linha: `${arquivo}.csv linha ${i + 1}` } as Linha;
    cabecalho.forEach((coluna, j) => (linha[coluna] = valores[j] ?? ''));
    resultado.push(linha);
  }
  return { value: resultado };
}

export interface Relatorio {
  criados: Record<Arquivo, number>;
  pulados: Record<Arquivo, number>;
  erros: string[];
}

const zerado = (): Record<Arquivo, number> => ({ especies: 0, recipientes: 0, canteiros: 0, funcionarios: 0 });

/** Grava a carga na transação do chamador. Com erro, o chamador desfaz: ver `scripts/carga-inicial.ts`. */
export async function importarCarga(client: PoolClient, carga: Partial<Record<Arquivo, Linha[]>>): Promise<Relatorio> {
  const r: Relatorio = { criados: zerado(), pulados: zerado(), erros: [] };
  const erro = (linha: Linha, msg: string) => r.erros.push(`${linha.__linha}: ${msg}`);

  for (const linha of carga.recipientes ?? []) {
    // `peso_kg` é opcional: a planilha antiga, sem a coluna, continua valendo
    const campos = parseRecipienteFields({ nome: linha.nome, volume: linha.volume_litros, peso: linha.peso_kg ?? '' });
    if ('error' in campos) {
      erro(linha, campos.error);
      continue;
    }
    const existe = await client.query('SELECT 1 FROM recipientes WHERE lower(nome) = lower($1)', [campos.value.nome]);
    if (existe.rowCount) r.pulados.recipientes++;
    else {
      await insertRecipiente(client, campos.value);
      r.criados.recipientes++;
    }
  }

  for (const linha of carga.canteiros ?? []) {
    const letra = parseLetra(linha.area);
    const nome = parseNomeArea(linha.nome_area);
    const numero = parseNumeroCanteiro(linha.canteiro);
    const capacidade = parseCapacidade(linha.capacidade);
    if ('error' in letra || 'error' in nome || 'error' in numero || 'error' in capacidade) {
      erro(linha, [letra, nome, numero, capacidade].map((p) => ('error' in p ? p.error : '')).find(Boolean)!);
      continue;
    }

    const area = await client.query<{ id: string }>('SELECT id FROM areas WHERE letra = $1', [letra.value]);
    const areaId = area.rows[0]?.id ?? (await insertArea(client, { letra: letra.value, nome: nome.value }));
    const existe = await client.query('SELECT 1 FROM canteiros WHERE area_id = $1 AND numero = $2', [areaId, numero.value]);
    if (existe.rowCount) r.pulados.canteiros++;
    else {
      await insertCanteiro(client, { areaId, numero: numero.value, capacidade: capacidade.value });
      r.criados.canteiros++;
    }
  }

  for (const linha of carga.especies ?? []) {
    const campos = parseEspecieFields({
      nomeCientifico: linha.nome_cientifico,
      // Na planilha os nomes populares vão separados por vírgula, na mesma célula
      nomesPopulares: linha.nomes_populares,
      caracteristicas: [],
      observacoes: linha.observacoes ?? '',
    });
    if ('error' in campos) {
      erro(linha, campos.error);
      continue;
    }
    const existe = await client.query('SELECT 1 FROM especies WHERE lower(nome_cientifico) = lower($1)', [campos.value.nomeCientifico]);
    if (existe.rowCount) r.pulados.especies++;
    else {
      await saveEspecie(client, null, { ...campos.value, ativa: true }, { nova: null, remover: false });
      r.criados.especies++;
    }
  }

  for (const linha of carga.funcionarios ?? []) {
    const nome = linha.nome.trim().replace(/\s+/g, ' ');
    if (nome.length < 2 || nome.length > 120) {
      erro(linha, 'O nome precisa ter de 2 a 120 caracteres.');
      continue;
    }
    const telefone = validateTelefone(linha.telefone);
    if ('error' in telefone) {
      erro(linha, telefone.error);
      continue;
    }
    const vinculo = linha.vinculo.trim().toLowerCase();
    if (vinculo !== 'fixo' && vinculo !== 'diarista') {
      erro(linha, 'O vínculo é "fixo" ou "diarista".');
      continue;
    }
    // Pessoa com o mesmo nome já cadastrada: pula, e a tela de pessoas resolve o papel se precisar (RF-14)
    const existe = await client.query('SELECT 1 FROM cadastro.pessoas WHERE lower(nome) = lower($1)', [nome]);
    if (existe.rowCount) r.pulados.funcionarios++;
    else {
      await savePessoa(
        client,
        null,
        {
          tipo: 'pf',
          nome,
          telefone: telefone.value,
          email: null,
          observacoes: null,
          ativa: true,
          papeis: [{ papel: 'funcionario', tipoVinculo: vinculo }],
          enderecos: [],
        },
        null,
      );
      r.criados.funcionarios++;
    }
  }

  return r;
}
