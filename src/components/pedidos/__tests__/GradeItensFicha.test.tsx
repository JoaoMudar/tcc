import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type ItemDaFicha, GradeItensFicha } from '../GradeItensFicha';

function item(sobre: Partial<ItemDaFicha> = {}): ItemDaFicha {
  return {
    id: 'a',
    especieId: 'e1',
    especie: 'Ipê-amarelo',
    nomeCientifico: null,
    generico: false,
    quantidade: 100,
    precoCentavos: null,
    recipienteId: 't',
    recipiente: 'Tubete',
    recipienteDisponivelId: null,
    recipienteDisponivel: null,
    alturaM: null,
    alturaDisponivelM: null,
    itemPaiId: null,
    especificacao: null,
    disponivel: null,
    quantidadeDisponivel: null,
    ...sobre,
  };
}

describe('GradeItensFicha (T8.1, RF-65)', () => {
  it('na leitura, o que falta fica vazio e vermelho, sem texto, e não há campo nem total', () => {
    render(<GradeItensFicha itens={[item({ recipienteId: null, recipiente: null })]} saldos={{}} />);
    expect(screen.queryByText('Definir')).toBeNull();
    const marcas = screen.getAllByText('Obrigatório preencher');
    expect(marcas.length).toBeGreaterThan(0);
    expect(marcas[0].className).toContain('sr-only');
    expect(marcas[0].closest('td')?.className).toContain('bg-red-50');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/total do pedido/i)).toBeNull();
    expect(screen.queryByText(/a definir na conferência/i)).toBeNull();
  });

  it('na negociação, preço e quantidade são campos em cada item', () => {
    const onAlterar = vi.fn();
    render(
      <GradeItensFicha
        itens={[item()]}
        saldos={{}}
        valores={{ a: { preco: '', quantidade: '100', recipienteId: 't' } }}
        onAlterar={onAlterar}
      />,
    );
    // Planilha e lista convivem na página: um campo de cada em cada desenho
    const precos = screen.getAllByLabelText('Preço do item 1');
    expect(precos).toHaveLength(2);
    fireEvent.change(precos[0], { target: { value: '8,50' } });
    expect(onAlterar).toHaveBeenCalledWith('a', 'preco', '8,50');
    expect(screen.getAllByLabelText('Quantidade do item 1')).toHaveLength(2);
  });

  it('com recipiente conferido diferente, a célula vira escolha entre os dois', () => {
    const conferido = item({ recipienteDisponivelId: 's', recipienteDisponivel: 'Saco 17x22', disponivel: true });
    render(
      <GradeItensFicha
        itens={[conferido]}
        saldos={{}}
        valores={{ a: { preco: '', quantidade: '100', recipienteId: 's' } }}
        onAlterar={vi.fn()}
      />,
    );
    const [escolha] = screen.getAllByLabelText('Recipiente do item 1');
    expect(Array.from((escolha as HTMLSelectElement).options).map((o) => o.textContent)).toEqual(['Tubete', 'Saco 17x22']);
  });

  it('o genérico com quantidade só recebe preço, e o filho dele não se negocia', () => {
    const pai = item({ id: 'g', generico: true, especie: null, especieId: null, recipienteId: null, recipiente: null });
    const filho = item({ id: 'f', itemPaiId: 'g', especie: 'Cedro' });
    render(
      <GradeItensFicha
        itens={[pai, filho]}
        saldos={{}}
        valores={{ g: { preco: '', quantidade: '', recipienteId: '' } }}
        onAlterar={vi.fn()}
      />,
    );
    expect(screen.getAllByLabelText('Preço do item 1')).toHaveLength(2);
    expect(screen.queryByLabelText('Quantidade do item 1')).toBeNull();
    expect(screen.queryByLabelText('Preço do item 2')).toBeNull();
  });

  it('a quantidade que falta é a célula vermelha, sem texto', () => {
    render(<GradeItensFicha itens={[item({ quantidade: null })]} saldos={{}} />);
    const [celula] = Array.from(document.querySelectorAll('tbody td')).slice(3, 4);
    expect(celula.textContent).toBe('Obrigatório preencher');
    expect(celula.className).toContain('bg-red-50');
  });

  it('na negociação, a quantidade que falta fica vermelha no campo, como o preço, sem placeholder', () => {
    render(
      <GradeItensFicha
        itens={[item({ quantidade: null })]}
        saldos={{}}
        valores={{ a: { preco: '', quantidade: '', recipienteId: 't' } }}
        onAlterar={vi.fn()}
      />,
    );
    const [quantidade] = screen.getAllByLabelText('Quantidade do item 1');
    expect(quantidade.getAttribute('placeholder')).toBeNull();
    expect(quantidade.getAttribute('aria-invalid')).toBe('true');
    expect(quantidade.className).toContain('bg-red-50');
    const [preco] = screen.getAllByLabelText('Preço do item 1');
    expect(preco.className).toContain('bg-red-50');
  });
});

describe('o que a verificação achou (barra no começo da linha)', () => {
  const tem = item({ id: 't1', disponivel: true });
  const parte = item({ id: 'p1', especie: 'Cedro', especieId: 'e2', disponivel: false, quantidadeDisponivel: 30 });
  const naoTem = item({ id: 'n1', especie: 'Ingá', especieId: 'e3', disponivel: false, quantidadeDisponivel: 0 });

  const primeiraCelula = () => Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')!.className);

  it('verde quando tem, amarelo quando tem parte, vermelho quando não tem', () => {
    render(<GradeItensFicha itens={[tem, parte, naoTem]} saldos={{}} mostraConferencia />);
    const [verde, amarelo, vermelho] = primeiraCelula();
    expect(verde).toContain('--color-green-600');
    expect(amarelo).toContain('--color-amber-400');
    expect(vermelho).toContain('--color-red-600');
  });

  it('sem pedir, a grade não pinta (depois da aprovação todo item é "tem")', () => {
    render(<GradeItensFicha itens={[tem]} saldos={{}} />);
    expect(primeiraCelula()[0]).not.toContain('--color-');
  });

  it('o "Não tem" deixa a quantidade vazia, sem botão de decidir', () => {
    render(
      <GradeItensFicha
        itens={[tem, naoTem]}
        saldos={{}}
        valores={{ t1: { preco: '', quantidade: '100', recipienteId: 't' } }}
        onAlterar={vi.fn()}
        mostraConferencia
      />,
    );
    expect(screen.queryByText('Não tem')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Substituir' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Excluir o item/ })).toBeNull();
  });
});

describe('estoque disponível na ficha (RF-62, RN-10)', () => {
  it('o item sem altura soma todos os lotes do par', () => {
    render(
      <GradeItensFicha
        itens={[item()]}
        saldos={{ 'e1:t': [{ alturaM: 0.5, quantidade: 60 }, { alturaM: null, quantidade: 70 }] }}
      />,
    );
    expect(screen.getByText('Disponível: 130')).toBeInTheDocument();
  });
});

describe('item dividido em recipientes: título com subitens', () => {
  // Pediu 50 em tubete; tem 30 em tubete e completou com 20 em saco 17x22
  const principal = item({
    id: 'p',
    quantidade: 50,
    disponivel: false,
    quantidadeDisponivel: 30,
    recipienteDisponivelId: 't',
    recipienteDisponivel: 'Tubete',
  });
  const complemento = item({
    id: 'c',
    quantidade: 20,
    recipienteId: 's',
    recipiente: 'Saco 17x22',
    disponivel: true,
    complementaItemId: 'p',
  });
  // A ordem do banco é por espécie e recipiente: o complemento (saco) pode vir antes do principal (tubete)
  const outro = item({ id: 'o', especie: 'Cedro', especieId: 'e2', quantidade: 10 });

  function linhasDaTabela() {
    return Array.from(document.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim()),
    );
  }

  it('o título mostra o pedido e o que temos, e as linhas reais vêm embaixo dele', () => {
    render(<GradeItensFicha itens={[outro, complemento, principal]} saldos={{}} mostraConferencia />);
    const [linhaOutro, titulo, linhaPrincipal, linhaComplemento] = linhasDaTabela();
    // A linha pai: cinza escuro e barra azul; o principal amarelo, o complemento verde
    const classes = Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.className);
    expect(classes[1]).toContain('bg-gray-700');
    expect(classes[1]).toContain('--color-blue-500');
    const barras = Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')!.className);
    expect(barras[2]).toContain('--color-amber-400');
    expect(barras[3]).toContain('--color-green-600');
    expect(titulo[0]).toContain('Ipê-amarelo');
    expect(titulo[0]).toContain('Temos 50 de 50');
    expect(titulo.slice(1)).toEqual(['Tubete', '', '50']);
    expect(linhaPrincipal[0]).toContain('↳');
    expect(linhaPrincipal.slice(1)).toEqual(['Tubete', '', '30']);
    expect(linhaComplemento[0]).toContain('↳');
    expect(linhaComplemento.slice(1)).toEqual(['Saco 17x22', '', '20']);
    expect(linhaOutro[0]).toContain('Cedro');
    expect(linhaOutro[0]).not.toContain('↳');
  });

  it('o que falta para o pedido aparece no título', () => {
    render(<GradeItensFicha itens={[principal, { ...complemento, quantidade: 10 }]} saldos={{}} />);
    expect(screen.getAllByText('Temos 40 de 50')[0].className).toMatch(/amber/);
  });

  it('"Tem tudo" dividido: o recipiente que o cliente não disse fica em branco no título', () => {
    const semRecipiente = { ...principal, recipienteId: null, recipiente: null };
    render(<GradeItensFicha itens={[semRecipiente, complemento]} saldos={{}} />);
    const [titulo, linhaPrincipal] = linhasDaTabela();
    expect(titulo[1]).toBe('');
    expect(linhaPrincipal[1]).toBe('Tubete');
    expect(screen.queryByText(/definir/i)).toBeNull();
    expect(screen.queryByText(/^Pedido:/)).toBeNull();
  });

  it('a parte sem complemento continua uma linha só', () => {
    render(<GradeItensFicha itens={[principal]} saldos={{}} />);
    expect(linhasDaTabela()).toHaveLength(1);
    expect(screen.queryByText(/^Temos/)).toBeNull();
  });

  it('na negociação, o título não tem campo e mantém o pedido enquanto se digita', () => {
    // O que ItensDaFicha passa enquanto a chefia digita: quantidade nova, conferência apagada
    const digitado = { ...principal, quantidade: 35, disponivel: true, quantidadeDisponivel: null };
    render(
      <GradeItensFicha
        itens={[digitado, complemento]}
        conferidos={[principal, complemento]}
        saldos={{}}
        valores={{
          p: { preco: '', quantidade: '35', recipienteId: 't' },
          c: { preco: '', quantidade: '20', recipienteId: 's' },
        }}
        onAlterar={vi.fn()}
      />,
    );
    const [titulo] = linhasDaTabela();
    expect(titulo[3]).toBe('50');
    expect(titulo[0]).toContain('Temos 50 de 50');
    // Os campos são das duas linhas reais, numeradas sem o título
    expect(screen.getAllByLabelText('Preço do item 1')).toHaveLength(2);
    expect(screen.getAllByLabelText('Preço do item 2')).toHaveLength(2);
    expect(screen.queryByLabelText('Preço do item 3')).toBeNull();
  });

  it('o suplente usado no item sem quantidade vira subitem, e o que sobra fica no título', () => {
    const semQuantidade = item({ id: 'p', quantidade: null, disponivel: true });
    const usado = item({ id: 'u', quantidade: null, recipienteId: 's', recipiente: 'Saco 17x22', disponivel: true, complementaItemId: 'p' });
    const sobrando = item({ id: 'x', recipienteId: 'b', recipiente: 'Balde', disponivel: true, complementaItemId: 'p' });
    render(<GradeItensFicha itens={[semQuantidade, usado]} suplentes={[sobrando]} saldos={{}} />);
    const [titulo, , linhaUsado] = linhasDaTabela();
    expect(titulo[0]).toContain('Temos em Tubete e Saco 17x22');
    expect(titulo[0]).toContain('também tem em Balde');
    expect(linhaUsado[0]).toContain('↳');
    // O aviso aparece uma vez em cada desenho (planilha e lista), e não repete no subitem
    expect(screen.getAllByText(/também tem em/)).toHaveLength(2);
  });
});
