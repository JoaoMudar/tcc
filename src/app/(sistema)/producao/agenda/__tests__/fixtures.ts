import type { AtribuicaoResumo } from '@/lib/agenda';

export const SEMANA = '2026-09-28';
export const MANHA = { id: '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d01', nome: 'manha', inicio: '07:30', fim: '11:30', ativo: true };
export const TARDE = { id: '0b9f3f3e-8a5b-4c1a-9d0e-2f6a7b8c9d02', nome: 'tarde', inicio: '13:30', fim: '17:30', ativo: true };
export const GILBERTO = { id: '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e01', nome: 'Gilberto' };
export const JOAO = { id: '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e02', nome: 'João' };
export const ANA = { id: '1c8e2d4f-9a6b-4d2c-8e1f-3a7b8c9d0e03', nome: 'Ana' };

/** Uma tarefa planejada, não quantitativa, de Gilberto na segunda de manhã. */
export function tarefa(over: Partial<AtribuicaoResumo> = {}): AtribuicaoResumo {
  return {
    id: 'a1',
    semanaId: 's',
    semanaInicio: SEMANA,
    semanaSituacao: 'aberta',
    data: SEMANA,
    turnoId: MANHA.id,
    turno: 'manha',
    horaInicio: null,
    horaFim: null,
    tipoTarefaId: 't',
    tipo: 'Encher saquinhos de substrato para a próxima semeadura',
    eQuantitativa: false,
    exigeLote: false,
    exigeEspecie: false,
    exigeRecipiente: false,
    exigeArea: false,
    unidadeMedida: 'un',
    categoria: 'terra',
    especieId: null,
    especie: null,
    recipienteId: null,
    recipiente: null,
    loteId: null,
    loteCodigo: null,
    areaId: null,
    area: null,
    canteiroId: null,
    canteiro: null,
    quantidadePlanejada: null,
    eRecorrente: false,
    situacao: 'planejada',
    observacoes: null,
    prioridadeEm: null,
    participantes: [{ ...GILBERTO, quantidade: null }],
    ...over,
  };
}
