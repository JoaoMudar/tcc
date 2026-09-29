import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LinhaDoTempo, sentidoDaFase, type FaseDoPedido } from '../LinhaDoTempo';

const dia = new Date('2026-09-28T15:00:00Z');

describe('sentidoDaFase', () => {
  it('a primeira fase é o início, mesmo sendo cadastrado', () => {
    expect(sentidoDaFase('cadastrado', 0)).toBe('inicio');
  });

  it('seguir o caminho avança', () => {
    expect(sentidoDaFase('verificando', 1)).toBe('avanca');
    expect(sentidoDaFase('aprovado', 3)).toBe('avanca');
    expect(sentidoDaFase('pronto_envio', 5)).toBe('avanca');
  });

  it('voltar ao cadastro, pedir alteração e cancelar retrocedem', () => {
    expect(sentidoDaFase('cadastrado', 4)).toBe('retrocede');
    expect(sentidoDaFase('pendente_alteracao', 3)).toBe('retrocede');
    expect(sentidoDaFase('cancelado', 2)).toBe('retrocede');
  });
});

describe('LinhaDoTempo', () => {
  it('lista uma fase por linha, com a seta do sentido', () => {
    const fases: FaseDoPedido[] = [
      { situacaoNova: 'cadastrado', criadoEm: dia },
      { situacaoNova: 'verificando', criadoEm: dia },
      { situacaoNova: 'verificado', criadoEm: dia },
      { situacaoNova: 'pendente_alteracao', criadoEm: dia },
    ];
    render(<LinhaDoTempo fases={fases} />);
    const itens = screen.getAllByRole('listitem');
    expect(itens).toHaveLength(4);
    expect(itens[0].textContent).toContain('•');
    expect(itens[1].textContent).toContain('Avançou');
    expect(itens[3].textContent).toContain('Retrocedeu');
    expect(itens[3].textContent).toContain('Alteração solicitada');
    expect(itens[3].getAttribute('aria-current')).toBe('step');
    expect(screen.queryByText('→')).toBeNull();
  });

  it('linha sem troca de situação é nota, sem seta, e não rouba o destaque da fase atual', () => {
    const fases: FaseDoPedido[] = [
      { situacaoAnterior: null, situacaoNova: 'cadastrado', criadoEm: dia },
      { situacaoAnterior: 'verificado', situacaoNova: 'aprovado', criadoEm: dia },
      {
        situacaoAnterior: 'aprovado',
        situacaoNova: 'aprovado',
        observacoes: 'Entrega marcada para 02/10 no planejamento da viagem.',
        criadoEm: dia,
      },
    ];
    render(<LinhaDoTempo fases={fases} />);
    const itens = screen.getAllByRole('listitem');
    expect(itens[2].textContent).toContain('Entrega marcada para 02/10');
    expect(itens[2].textContent).not.toContain('Avançou');
    expect(itens[1].getAttribute('aria-current')).toBe('step');
    expect(itens[2].getAttribute('aria-current')).toBeNull();
  });

  it('sem fases, não mostra nada', () => {
    const { container } = render(<LinhaDoTempo fases={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
