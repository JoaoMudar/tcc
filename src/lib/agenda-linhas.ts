/**
 * As linhas da grade da semana, sem SQL: a grade do navegador remonta as linhas
 * a cada arrasto otimista, e por isso a conta mora fora de `agenda.ts`.
 */

import type { AtribuicaoResumo, Funcionario } from './agenda';

export interface LinhaGrade {
  /** `null` na linha das tarefas sem ninguém escalado. */
  pessoa: Funcionario | null;
  porDia: Record<string, AtribuicaoResumo[]>;
}

/**
 * T5.1: uma linha por pessoa, e a tarefa do grupo aparece na linha de cada um.
 * Funcionário inativo some da grade, mas não da semana em que trabalhou.
 */
export function montarGrade(funcionarios: readonly Funcionario[], atribuicoes: readonly AtribuicaoResumo[]): LinhaGrade[] {
  const linhas = new Map<string, LinhaGrade>(funcionarios.map((f) => [f.id, { pessoa: f, porDia: {} }]));
  const semNinguem: LinhaGrade = { pessoa: null, porDia: {} };
  const colocar = (linha: LinhaGrade, a: AtribuicaoResumo) => {
    linha.porDia[a.data] = [...(linha.porDia[a.data] ?? []), a];
  };

  for (const atribuicao of atribuicoes) {
    if (atribuicao.participantes.length === 0) colocar(semNinguem, atribuicao);
    for (const p of atribuicao.participantes) {
      if (!linhas.has(p.id)) linhas.set(p.id, { pessoa: { id: p.id, nome: p.nome }, porDia: {} });
      colocar(linhas.get(p.id)!, atribuicao);
    }
  }

  const grade = [...linhas.values()].sort((a, b) => a.pessoa!.nome.localeCompare(b.pessoa!.nome, 'pt-BR'));
  return Object.keys(semNinguem.porDia).length > 0 ? [...grade, semNinguem] : grade;
}

/** O que um arrasto, uma tecla ou o painel mudam numa tarefa. */
export interface Mudanca {
  id: string;
  dia: string;
  turnoId: string;
  /** O nome do turno novo, para o card e o painel dizerem "tarde" antes da resposta. */
  turnoNome?: string;
  horaInicio: string | null;
  horaFim: string | null;
  /** RN-61: a pessoa de destino substitui a de origem. `sai` nulo é a linha "Sem ninguém". */
  troca?: { sai: string | null; entra: { id: string; nome: string } } | null;
}

/** RF-26: a tarefa escolhida como principal onde se cruza com outra na grade. */
export interface Promocao {
  id: string;
  prioridadeEm: string;
}

/** O mesmo formato que `listAgendaSemana` devolve, para a ordem de texto valer contra o banco. */
export function prioridadeAgora(): string {
  return new Date().toISOString().replace('Z', '000Z');
}

/** O estado otimista da grade: a tarefa já no lugar novo, antes de o servidor responder. */
export function aplicarMudanca(lista: readonly AtribuicaoResumo[], mudanca: Mudanca | Promocao): AtribuicaoResumo[] {
  return lista.map((a) => {
    if (a.id !== mudanca.id) return a;
    if ('prioridadeEm' in mudanca) return { ...a, prioridadeEm: mudanca.prioridadeEm };
    const participantes = mudanca.troca
      ? [
          ...a.participantes.filter((p) => p.id !== mudanca.troca!.sai),
          { id: mudanca.troca.entra.id, nome: mudanca.troca.entra.nome, quantidade: null },
        ].sort((um, outro) => um.nome.localeCompare(outro.nome, 'pt-BR'))
      : a.participantes;
    return {
      ...a,
      data: mudanca.dia,
      turnoId: mudanca.turnoId,
      turno: mudanca.turnoNome ?? a.turno,
      horaInicio: mudanca.horaInicio, horaFim: mudanca.horaFim, participantes };
  });
}

/** O formulário que `reagendarAtribuicaoAction` lê. */
export function dadosDaMudanca(mudanca: Mudanca): FormData {
  const dados = new FormData();
  dados.set('id', mudanca.id);
  dados.set('data', mudanca.dia);
  dados.set('turno_id', mudanca.turnoId);
  dados.set('hora_inicio', mudanca.horaInicio ?? '');
  dados.set('hora_fim', mudanca.horaFim ?? '');
  if (mudanca.troca) {
    dados.set('sai', mudanca.troca.sai ?? '');
    dados.set('entra', mudanca.troca.entra.id);
  }
  return dados;
}
