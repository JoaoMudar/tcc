import { readFileSync, writeFileSync } from 'node:fs';

const f = 'docs/engenharia/D-arquitetura/D1-arquitetura-c4.md';
let t = readFileSync(f, 'utf8');

function troca(de, para) {
  if (!t.includes(de)) throw new Error(`nao achei: ${de.slice(0, 70)}`);
  t = t.replace(de, para);
}

// ---------------------------------------------------------------- nivel 1
troca(
  `  subgraph usuarios["Usuários do viveiro"]
    CH["Chefia<br/>vendas, finanças, decisões"]
    GE["Gerência<br/>operação e coordenação"]
    CO["Colaborador<br/>execução em campo"]
  end

  SIS["<b>Sistema de gestão do viveiro</b><br/>Custeio, produção, estoque, perdas,<br/>pedidos, fornecedores e financeiro"]

  NF["Emissor de nota fiscal<br/><i>sistema externo</i>"]
  WA["Serviço de mensageria<br/><i>WhatsApp</i>"]
  GEO["Serviço de geocodificação<br/><i>externo</i>"]
  BCO["Instituições bancárias<br/><i>arquivo de extrato</i>"]

  CH --> SIS
  GE --> SIS
  CO --> SIS

  SIS -.->|"dados da venda;<br/>recebe o número da nota"| NF
  SIS -.->|"mensagem de cotação,<br/>enviada por ação do usuário"| WA
  SIS -.->|"cidade e estado do fornecedor"| GEO
  BCO -.->|"arquivo de extrato,<br/>importado manualmente"| SIS`,
  `  subgraph usuarios["Usuários do viveiro"]
    CH["Chefia<br/>vendas, pedidos, decisões"]
    GE["Gerência<br/>operação e coordenação"]
  end

  SIS["<b>Sistema de gestão do viveiro</b><br/>Cadastro único, agenda da semana,<br/>lotes e pedidos"]

  NF["Emissor de nota fiscal<br/><i>sistema externo</i>"]
  WA["Serviço de mensageria<br/><i>WhatsApp</i>"]

  CH --> SIS
  GE --> SIS

  SIS -.->|"dados cadastrais do cliente"| NF
  WA -.->|"pedido negociado,<br/>registrado à mão depois"| SIS`
);
troca(
  `**Nenhuma das integrações externas é automática.** O envio da cotação é sempre clique do usuário; o
extrato é arquivo que a chefia baixa e importa; a nota fiscal é emitida no sistema externo e o número
é informado de volta. É decisão de projeto compatível com a restrição de orçamento e com a
inexistência de interface programática nos sistemas envolvidos, e, no caso da mensageria, também de
conformidade (ver [\`E5\`](../E-qualidade/E5-mapeamento-lgpd.md)).`,
  `**Nenhuma das duas integrações é automática, e as setas pontilhadas dizem isso.** A nota fiscal é
emitida no sistema externo, que apenas consome o cadastro que este mantém; a negociação por
WhatsApp é conduzida por pessoa, e o pedido chega ao sistema digitado por quem vendeu. É decisão de
projeto compatível com a restrição de orçamento e com a inexistência de interface programática nos
sistemas envolvidos, e, no caso da mensageria, também de conformidade (ver
[\`E5\`](../E-qualidade/E5-mapeamento-lgpd.md)).

**Os colaboradores de campo não aparecem porque não são usuários do sistema.** O trabalho deles é
planejado e confirmado pela gerência ([\`A1\` §5](../A-fundacao/A1-documento-de-visao.md)), e um
diagrama de contexto que os desenhasse estaria descrevendo a empresa, e não o software.`
);

// ---------------------------------------------------------------- nivel 3
troca(
  `Decomposição interna do servidor, organizada pelos **quatro módulos** do sistema
(\`docs/rotinas/00-mapa-de-rotinas.md\`), com Acesso transversal.`,
  `Decomposição interna do servidor, organizada pelas **três áreas de negócio** do sistema
(\`docs/rotinas/00-mapa-de-rotinas.md\`), com Acesso e Configurações transversais.`
);

const compAntigo = t.slice(t.indexOf('```mermaid\ngraph TB\n  subgraph acesso'), t.indexOf('### O que o grafo de dependências revela'));
t = t.replace(
  compAntigo,
  `\`\`\`mermaid
graph TB
  subgraph acesso["Acesso e configurações: transversais"]
    A1["Autenticação de sessão"]
    A2["Autorização por perfil"]
    A3["Auditoria de acesso"]
    A4["Parâmetros do sistema"]
  end

  subgraph cadastros["1 · Cadastro único"]
    N1["Catálogo de espécies"]
    N2["Cadastro de recipientes e insumos"]
    N3["Identidade única de pessoas"]
    N4["Áreas, canteiros e tipos de tarefa"]
    N5["Protocolo de atividades"]
  end

  subgraph producao["2 · Produção"]
    O1["Agenda da semana"]
    O2["Lotes e movimentos"]
    O3["Motor do protocolo"]
    O4["Mapa e estatísticas do lote"]
  end

  subgraph comercial["3 · Comercial"]
    C2["Cadastro de pedidos"]
  end

  O1 --> N4
  O2 --> N1
  O2 --> N2
  O3 --> N5
  O3 --> O2
  O3 -.->|"gera ordem na agenda"| O1
  O4 --> O2
  O4 --> O1
  O4 --> A4
  O1 --> N3
  C2 --> N3
  C2 --> N1
  C2 -.->|"saldo de muda pronta"| O2

  A2 -.->|"protege"| cadastros
  A2 -.->|"protege"| producao
  A2 -.->|"protege"| comercial

\`\`\`

`
);

troca(
  `**O motor de custeio é a raiz, e ele mora no Financeiro.** Precificação depende dele, e ele
depende apenas do catálogo de Cadastros e das compras. É a tradução arquitetural da ordem de
implementação declarada no §3.5 da metodologia: o custeio é o primeiro projeto porque nada mais
funciona sem ele. Custo e preço são dinheiro, ficam no módulo do dinheiro, não num "núcleo"
à parte.

**A apuração de estoque depende de produção e perdas, e o ciclo de pedidos depende dela.** A cadeia
explica por que a verificação de disponibilidade não pode ser confiável antes de os registros de
campo estarem em uso: o estoque é derivado, não digitado.

**O Financeiro alimenta a Produção de volta**, por dois caminhos: a compra de insumo, que nasce
lá e fica disponível para uso no campo, e o custo fixo efetivamente saído da conta, em lugar de
um valor estimado. São as dependências que atravessam a fronteira do módulo restrito, e por
isso são de leitura agregada: o custeio recebe o total do período, nunca o lançamento
individual. É esse retorno que fecha o ciclo; sem ele, o preço volta a ser estimativa.`,
  `**O Cadastro único é a raiz, e nada nele depende de nada.** Todas as setas apontam para ele, e
nenhuma sai. É a tradução arquitetural do que o sistema afirma: o catálogo é o que as outras duas
áreas consomem, e é por isso que ele é a primeira coisa a existir.

**O motor do protocolo é o único componente que escreve numa área que não é a sua.** Ele lê a
etapa em Cadastro único, lê o lote em Produção e **gera ordem na agenda**, que também é Produção.
A seta pontilhada marca que a escrita é automática: nenhum usuário a aciona, e é justamente essa
a razão de o componente existir (RF-127).

**O Comercial depende da Produção por uma única aresta, e ela é de leitura.** \`C2\` consulta o
saldo de muda pronta em \`O2\` e não escreve nada lá: o pedido não reserva, não baixa e não move
lote. É a interconexão que o trabalho existe para demonstrar, e o diagrama mostra que ela custa
uma seta.

**O mapa depende de três coisas, e uma delas é parâmetro.** \`O4\` lê lote, lê agenda e lê
\`A4\`, os limites de atraso e de mortalidade. É o que torna a cor da tela ajustável sem
implantação (RN-94), e é a razão de Configurações ser transversal e não um canto do Cadastro
único.`
);

writeFileSync(f, t);
console.log('D1 atualizado.');
