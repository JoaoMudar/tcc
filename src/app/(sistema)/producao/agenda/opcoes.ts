import { listFuncionarios } from '@/lib/agenda';
import { listAreas } from '@/lib/areas';
import pool from '@/lib/db';
import { nomeExibido, searchEspecies } from '@/lib/especies';
import { listLotesAbertos } from '@/lib/lotes';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { diaMes, diasDaSemana, siglaDia } from '@/lib/semanas';
import { listTiposTarefa } from '@/lib/tipos-tarefa';
import { listTurnos, turnoLabel } from '@/lib/turnos';
import type { OpcoesAtribuicao } from './AtribuicaoForm';

/** As listas fechadas do formulário da atribuição (RNF-02): só o que está em uso. */
export async function carregarOpcoes(semana: string): Promise<OpcoesAtribuicao & { faltam: string[] }> {
  const [funcionarios, tipos, turnos, lotes, especies, recipientes, areas] = await Promise.all([
    listFuncionarios(pool),
    listTiposTarefa(pool),
    listTurnos(pool),
    listLotesAbertos(pool),
    searchEspecies(pool),
    listRecipientes(pool),
    listAreas(pool),
  ]);
  const opcoes: OpcoesAtribuicao = {
    funcionarios: funcionarios.map((f) => ({ value: f.id, label: f.nome })),
    tipos: tipos
      .filter((t) => t.ativo)
      .map(({ id, nome, eQuantitativa, exigeLote, exigeEspecie, exigeRecipiente }) => ({
        id,
        nome,
        eQuantitativa,
        exigeLote,
        exigeEspecie,
        exigeRecipiente,
      })),
    turnos: turnos.filter((t) => t.ativo).map((t) => ({ value: t.id, label: `${turnoLabel(t.nome)} · ${t.inicio}` })),
    dias: diasDaSemana(semana).map((dia) => ({ value: dia, label: `${siglaDia(dia)} ${diaMes(dia)}` })),
    lotes: lotes.map((l) => ({ value: l.id, label: `${l.codigo} · ${l.especie} · ${l.recipiente}` })),
    especies: especies.filter((e) => e.ativa).map((e) => ({ value: e.id, label: nomeExibido(e) })),
    recipientes: recipientes
      .filter((r) => r.ativo)
      .map((r) => ({ value: r.id, label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}` })),
    areas: areas.map((a) => ({ id: a.id, letra: a.letra, canteiros: a.canteiros })),
  };
  const faltam = [
    opcoes.funcionarios.length === 0 && 'funcionário',
    opcoes.tipos.length === 0 && 'tipo de tarefa',
    opcoes.turnos.length === 0 && 'turno de trabalho',
  ].filter((item): item is string => typeof item === 'string');
  return { ...opcoes, faltam };
}
