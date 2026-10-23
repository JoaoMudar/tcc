import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GradeItens } from '../GradeItens';
import { type Linha, linhaVazia } from '../linhas-pedido';

const ESPECIES = [
  { value: 'ipe', label: 'Ipê-amarelo' },
  { value: 'pit', label: 'Pitanga' },
];
const RECIPIENTES = [{ value: 'tub', label: 'Tubete · 0,05 L' }];

function preenchida(extra: Partial<Linha> = {}): Linha {
  return { ...linhaVazia(1), especieId: 'ipe', recipienteId: 'tub', altura: '1,20', quantidade: '500', ...extra };
}

function montar(linhas: readonly Linha[], acoes: Partial<Parameters<typeof GradeItens>[0]> = {}) {
  const props = {
    linhas,
    opcoesEspecie: ESPECIES,
    recipientes: RECIPIENTES,
    saldos: {},
    onAlterar: vi.fn(),
    onRemover: vi.fn(),
    onAdicionar: vi.fn(),
    onEditar: vi.fn(),
    onColar: vi.fn(),
    onColarLista: vi.fn(),
    onCriarEspecie: vi.fn(),
    ...acoes,
  };
  return { ...render(<GradeItens {...props} />), props };
}

/** Os campos que o formulário envia, que são os escondidos e não os visíveis. */
function enviados(container: HTMLElement, nome: string): string[] {
  return [...container.querySelectorAll<HTMLInputElement>(`input[name="${nome}"]`)].map((campo) => campo.value);
}

describe('planilha de itens do pedido (T8.1, RF-59)', () => {
  it('as colunas saem na ordem em que se lê um pedido', () => {
    montar([preenchida()]);
    const textos = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(textos).toEqual(['Espécie', 'Recipiente', 'Altura', 'Quantidade', 'Excluir']);
  });

  it('cada linha manda um campo escondido de cada, e não um por desenho de tela', () => {
    const { container } = montar([preenchida(), preenchida({ chave: 2, especieId: 'pit', altura: '', quantidade: '30' })]);
    expect(enviados(container, 'item_especie')).toEqual(['ipe', 'pit']);
    expect(enviados(container, 'item_altura')).toEqual(['1,20', '']);
    expect(enviados(container, 'item_quantidade')).toEqual(['500', '30']);
    expect(enviados(container, 'item_recipiente')).toEqual(['tub', 'tub']);
  });

  it('o item genérico vai sem espécie, ainda que a linha tenha uma guardada', () => {
    const { container } = montar([preenchida({ generico: true })]);
    expect(enviados(container, 'item_especie')).toEqual(['']);
    expect(enviados(container, 'item_generico')).toEqual(['1']);
  });

  it('o genérico manda a observação, e o item com espécie não manda', () => {
    const { container } = montar([
      preenchida({ generico: true, especificacao: 'mudas nativas, o que tiver' }),
      preenchida({ chave: 2, especificacao: 'sobra de antes' }),
    ]);
    expect(enviados(container, 'item_especificacao')).toEqual(['mudas nativas, o que tiver', '']);
  });

  it('o grupo do genérico vai numa posição só da lista paralela, e o item com espécie manda vazio', () => {
    const grupo = [
      { chave: 1, especieId: 'ipe' },
      { chave: 2, especieId: '' },
      { chave: 3, especieId: 'pit' },
    ];
    const { container } = montar([preenchida({ generico: true, grupo }), preenchida({ chave: 2, grupo })]);
    expect(enviados(container, 'item_especies_permitidas')).toEqual(['ipe,pit', '']);
    expect(screen.getByLabelText('Espécie 1 do grupo do item 1')).toHaveValue('Ipê-amarelo');
    expect(screen.queryByLabelText('Espécie 1 do grupo do item 2')).toBeNull();
    // Na lista do celular, o tamanho do grupo junto do recipiente
    expect(screen.getByText(/grupo de 2 espécies/)).toBeInTheDocument();
  });

  it('a linha sem espécie pode virar genérico, e o recipiente em branco vai vazio', () => {
    const onAlterar = vi.fn();
    const { container } = montar([{ ...linhaVazia(1), quantidade: '10' }], { onAlterar });
    expect(enviados(container, 'item_recipiente')).toEqual(['']);
    fireEvent.focus(screen.getByLabelText('Espécie do item 1'));
    fireEvent.click(screen.getByText('Genérico'));
    expect(onAlterar).toHaveBeenCalledWith(1, 'generico', true);
  });

  it('o genérico fica no campo da espécie, em azul, com a descrição embaixo', () => {
    const { container } = montar([preenchida({ generico: true }), preenchida({ chave: 2 })]);
    expect(screen.getByLabelText('Espécie do item 1')).toHaveValue('Genérico');
    expect(screen.getByLabelText('Observação do item 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Observação do item 2')).toBeNull();
    expect(screen.queryByText(/Escolher a espécie/)).toBeNull();
    const [generica, comEspecie] = container.querySelectorAll('tbody tr');
    expect(generica).toHaveClass('bg-blue-50');
    expect(comEspecie).not.toHaveClass('bg-blue-50');
  });

  it('as células não dizem "a definir" nem "opcional", e a espécie leva a marca de obrigatório', () => {
    montar([linhaVazia(1)]);
    expect(screen.queryByPlaceholderText(/a definir|opcional/i)).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Espécie' }).className).toContain("after:content-['*']");
    expect(screen.getByRole('columnheader', { name: 'Recipiente' }).className).not.toContain('after:content');
  });

  it('no celular, o genérico sem observação aparece só como "Genérico"', () => {
    montar([preenchida({ generico: true, especieId: '', especificacao: '' })]);
    expect(screen.getByText('Genérico', { selector: 'li span' })).toBeInTheDocument();
  });

  it('escolher uma espécie no genérico desfaz o genérico', () => {
    const onAlterar = vi.fn();
    montar([preenchida({ generico: true, especieId: '' })], { onAlterar });
    fireEvent.change(screen.getByLabelText('Espécie do item 1'), { target: { value: 'pit' } });
    expect(onAlterar).toHaveBeenCalledWith(1, 'generico', false);
    fireEvent.click(screen.getByText('Pitanga'));
    expect(onAlterar).toHaveBeenLastCalledWith(1, 'especieId', 'pit');
  });

  it('a lixeira tira a linha, e o "+" acrescenta outra', () => {
    const onRemover = vi.fn();
    const onAdicionar = vi.fn();
    montar([preenchida()], { onRemover, onAdicionar });

    fireEvent.click(screen.getByLabelText('Excluir o item 1'));
    expect(onRemover).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('+ Adicionar linha'));
    expect(onAdicionar).toHaveBeenCalledWith(false);
    // No celular a linha nova abre em tela cheia, e é outro botão
    fireEvent.click(screen.getByText('+ Adicionar item'));
    expect(onAdicionar).toHaveBeenCalledWith(true);
  });

  it('no celular a linha não se edita: ela abre o item em tela cheia', () => {
    const onEditar = vi.fn();
    montar([preenchida()], { onEditar });
    // A linha da lista é um botão inteiro, e é o único lugar com esse nome
    fireEvent.click(screen.getByRole('button', { name: /Ipê-amarelo/ }));
    expect(onEditar).toHaveBeenCalledWith(1);
  });

  it('o botão de colar lista chama a revisão, e não cola nada sozinho', () => {
    const onColarLista = vi.fn();
    montar([preenchida()], { onColarLista });
    fireEvent.click(screen.getByText('📋 Colar lista'));
    expect(onColarLista).toHaveBeenCalled();
  });

  it('o Ctrl+V de várias linhas é entregue com a célula em que o cursor estava', () => {
    const onColar = vi.fn();
    montar([preenchida(), preenchida({ chave: 2 })], { onColar });

    fireEvent.focus(screen.getByLabelText('Quantidade do item 2'));
    fireEvent.paste(screen.getByLabelText('Quantidade do item 2'), {
      clipboardData: { getData: () => '500\n300' },
    });
    expect(onColar).toHaveBeenCalledWith('500\n300', { linha: 1, coluna: 3 });
  });

  it('colar uma célula só é colagem comum, e o navegador é quem faz', () => {
    const onColar = vi.fn();
    montar([preenchida()], { onColar });
    fireEvent.paste(screen.getByLabelText('Quantidade do item 1'), {
      clipboardData: { getData: () => '500' },
    });
    expect(onColar).not.toHaveBeenCalled();
  });

  it('no celular o científico vai miúdo embaixo do nome popular', () => {
    montar([preenchida()], { opcoesEspecie: [{ value: 'ipe', label: 'Ipê-amarelo', detalhe: 'Handroanthus albus' }] });
    expect(screen.getAllByText('Handroanthus albus').length).toBeGreaterThan(0);
  });

  it('a espécie que não está no catálogo se cadastra dali mesmo, pela linha', () => {
    const onCriarEspecie = vi.fn();
    montar([preenchida({ chave: 7, especieId: '' })], { onCriarEspecie });
    fireEvent.change(screen.getByLabelText('Espécie do item 1'), { target: { value: 'Guapuruvu' } });
    fireEvent.click(screen.getByText('+ Cadastrar "Guapuruvu" como espécie nova'));
    expect(onCriarEspecie).toHaveBeenCalledWith(7, 'Guapuruvu');
  });

  it('a altura sai em metros enquanto é digitada', () => {
    const onAlterar = vi.fn();
    montar([preenchida({ altura: '' })], { onAlterar });
    fireEvent.change(screen.getByLabelText('Altura do item 1, em metros'), {
      target: { value: '123' },
    });
    expect(onAlterar).toHaveBeenLastCalledWith(1, 'altura', '1,23 m');
  });

  it('no celular a altura aparece uma vez só com a unidade', () => {
    montar([preenchida({ altura: '1,20 m' })]);
    expect(screen.getByText('Tubete · 0,05 L · 1,20 m')).toBeInTheDocument();
  });
});

describe('estoque disponível na linha (RF-62, RN-10)', () => {
  it('fala em disponível, sem "pronto" nem "em produção", e avisa a falta com o que há até 20 cm abaixo', () => {
    montar([preenchida()], {
      saldos: {
        'ipe:tub': [
          { alturaM: 1.3, quantidade: 400 },
          { alturaM: 1.05, quantidade: 80 },
        ],
      },
    });
    expect(screen.getByText('Disponível: 400 · faltam 100 · 80 com até 20 cm a menos')).toBeInTheDocument();
    expect(screen.queryByText(/Pronto|em produção/)).toBeNull();
  });
});

describe('o pedido que voltou da verificação (Solicitar alteração)', () => {
  const pai = { id: 'p', nome: 'Ipê-amarelo', recipiente: 'Tubete', altura: null, quantidade: 50, temos: 'Temos 30 de 50', completo: false };
  const filho = { id: 'f', nome: 'Cedro', recipiente: 'Saco 17x22', altura: '1,20 m', quantidade: 40 };

  it('sem a verificação, a grade é a do cadastro: nenhuma barra, nenhuma linha a mais', () => {
    montar([preenchida()]);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(document.querySelector('tbody td')!.className).not.toContain('--color-');
  });

  it('cada linha tem a barra e a frase do que a verificação achou', () => {
    montar([preenchida(), preenchida({ chave: 2, especieId: 'pit' })], {
      conferencia: {
        1: { estado: 'nao_tem', resumo: 'Verificação: não tem' },
        2: { estado: 'tudo', resumo: 'Verificação: tem 500' },
      },
    });
    const barras = Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')!.className);
    expect(barras[0]).toContain('--color-red-600');
    expect(barras[1]).toContain('--color-green-600');
    // Planilha e lista: a frase aparece nos dois desenhos
    expect(screen.getAllByText('Verificação: não tem')).toHaveLength(2);
  });

  it('o item dividido ganha a linha pai, só de leitura, com o que o cliente pediu', () => {
    montar([preenchida()], { pais: { 1: pai }, conferencia: { 1: { estado: 'parte', resumo: 'Verificação: tem 30' } } });
    const [linhaPai, linhaItem] = Array.from(document.querySelectorAll('tbody tr'));
    expect(linhaPai.className).toContain('bg-gray-700');
    expect(linhaPai.className).toContain('--color-blue-500');
    expect(linhaPai.textContent).toContain('Pedido do cliente');
    expect(linhaPai.textContent).toContain('Temos 30 de 50');
    expect(linhaPai.querySelector('input')).toBeNull();
    expect(linhaItem.querySelector('td')!.className).toContain('--color-amber-400');
    // A linha pai não conta como item: o campo continua sendo o do item 1
    expect(screen.getByLabelText('Quantidade do item 1')).toBeInTheDocument();
  });

  it('as espécies do genérico vêm embaixo dele, só de leitura', () => {
    montar([preenchida({ generico: true, especieId: '' })], { filhos: { 1: [filho] } });
    const linhas = Array.from(document.querySelectorAll('tbody tr'));
    expect(linhas).toHaveLength(2);
    expect(linhas[1].textContent).toContain('Cedro');
    expect(linhas[1].querySelector('input')).toBeNull();
    expect(screen.getAllByText('↳ Cedro')).toHaveLength(1);
  });
});
