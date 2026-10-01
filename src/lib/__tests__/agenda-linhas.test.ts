import { describe, expect, it } from 'vitest';
import { tarefa, GILBERTO, JOAO, MANHA, TARDE } from '@/app/(sistema)/producao/agenda/__tests__/fixtures';
import { aplicarMudanca, dadosDaMudanca, prioridadeAgora } from '../agenda-linhas';
import { confirmavelNumToque } from '../agenda-rotulos';

describe('aplicarMudanca (estado otimista da grade)', () => {
  it('move dia, turno e hora, e só a tarefa mexida', () => {
    const outra = tarefa({ id: 'a2' });
    const [movida, intacta] = aplicarMudanca([tarefa(), outra], {
      id: 'a1',
      dia: '2026-09-30',
      turnoId: TARDE.id,
      turnoNome: 'tarde',
      horaInicio: '14:00',
      horaFim: null,
    });
    expect(movida).toMatchObject({ data: '2026-09-30', turnoId: TARDE.id, turno: 'tarde', horaInicio: '14:00', horaFim: null });
    expect(intacta).toBe(outra);
  });

  it('RN-61: quem entra substitui quem sai, e o grupo segue em ordem de nome', () => {
    const grupo = tarefa({ participantes: [{ ...GILBERTO, quantidade: null }, { id: 'p9', nome: 'Zé', quantidade: null }] });
    const [movida] = aplicarMudanca([grupo], {
      id: 'a1',
      dia: grupo.data,
      turnoId: MANHA.id,
      horaInicio: null,
      horaFim: null,
      troca: { sai: GILBERTO.id, entra: JOAO },
    });
    expect(movida.participantes.map((p) => p.nome)).toEqual(['João', 'Zé']);
  });

  it('RF-26: trazer para cima só muda a precedência, no formato do banco', () => {
    const agora = prioridadeAgora();
    expect(agora).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    const [promovida] = aplicarMudanca([tarefa()], { id: 'a1', prioridadeEm: agora });
    expect(promovida).toEqual({ ...tarefa(), prioridadeEm: agora });
  });
});

describe('dadosDaMudanca', () => {
  it('monta o formulário de reagendarAtribuicaoAction, com a troca quando há', () => {
    const dados = dadosDaMudanca({
      id: 'a1',
      dia: '2026-09-30',
      turnoId: TARDE.id,
      horaInicio: null,
      horaFim: null,
      troca: { sai: null, entra: JOAO },
    });
    expect(Object.fromEntries(dados.entries())).toEqual({
      id: 'a1',
      data: '2026-09-30',
      turno_id: TARDE.id,
      hora_inicio: '',
      hora_fim: '',
      sai: '',
      entra: JOAO.id,
    });
    expect(dadosDaMudanca({ id: 'a1', dia: '2026-09-30', turnoId: TARDE.id, horaInicio: null, horaFim: null }).has('entra')).toBe(false);
  });
});

describe('confirmavelNumToque (RF-29 no celular)', () => {
  it('a tarefa sem nada a perguntar confirma num toque', () => {
    expect(confirmavelNumToque(tarefa())).toBe(true);
    expect(confirmavelNumToque(tarefa({ exigeLote: true, loteId: 'l1' }))).toBe(true);
  });

  it('a quantitativa e a de lote sem lote vão para a ficha', () => {
    expect(confirmavelNumToque(tarefa({ eQuantitativa: true }))).toBe(false);
    expect(confirmavelNumToque(tarefa({ exigeLote: true, loteId: null }))).toBe(false);
  });

  it('sem gente, já confirmada ou em semana fechada, não há o que confirmar', () => {
    expect(confirmavelNumToque(tarefa({ participantes: [] }))).toBe(false);
    expect(confirmavelNumToque(tarefa({ situacao: 'confirmada' }))).toBe(false);
    expect(confirmavelNumToque(tarefa({ semanaSituacao: 'fechada' }))).toBe(false);
  });
});
