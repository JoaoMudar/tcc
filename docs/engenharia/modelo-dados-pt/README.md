# Modelo de dados em figuras (versão para o TCC)

Mesmo modelo de [`../C-modelagem/C6-modelo-entidade-relacionamento.md`](../C-modelagem/C6-modelo-entidade-relacionamento.md).
A estrutura (entidades, cardinalidades, chaves, caixas vazias para entidade de outro módulo) é
idêntica: muda o recorte das figuras, que é mais fino que o dos quatro diagramas lógicos do `C6`.

**Esta pasta já não é uma tradução.** Ela foi criada quando o banco nomeava tabelas e colunas em
inglês e as figuras impressas precisavam de português. O banco passou a ser em português também, e
o que restou aqui é o recorte e o cuidado com a legibilidade impressa. O registro do que foi
renomeado, e do que o aplicativo em outro repositório precisa acompanhar, está em
[`de-para-ingles-portugues.md`](de-para-ingles-portugues.md).

**São doze figuras para vinte e sete entidades**, e nenhuma precisa ser dividida nem girada. Não
foi sempre assim: até a redução de escopo eram dezenove figuras para sessenta e duas entidades, com
duas obrigando a paisagem e várias raspando o piso de legibilidade. O ganho não veio de desenhar
melhor, veio de haver menos o que desenhar.

Fonte Mermaid em `mmd/`, PNGs em `img/`, layout em `mermaid-config.json` (`nodeSpacing` 30 e
`rankSpacing` 45 no lugar dos padrões 140 e 80 do Mermaid, que são a causa do espalhamento).
Para regerar uma figura:

```
npx -y @mermaid-js/mermaid-cli -i mmd/fig06-conceitual-producao.mmd -o img/fig06-conceitual-producao.png -c mermaid-config.json -s 3 -b white
```

O `-s 3` renderiza a 3x: no Word a imagem entra reduzida e continua nítida na impressão.

> ⚠️ **Esta pasta não é gerada por script.** Toda mudança em `C6`/`C8` (entidade, atributo, chave,
> cardinalidade) precisa ser repetida no `.mmd` da figura correspondente e o `.png` regerado com o
> comando acima. Regra declarada no [`CLAUDE.md`](../../../CLAUDE.md) §Banco de dados.

## Figuras

A coluna **fonte útil** é medida por `scripts/mede-figuras.mjs`, que lê a dimensão do PNG e calcula
o tamanho que o texto assume ao encaixar a figura na mancha de 16 x 24 cm. **Rode o script depois de
regerar qualquer figura**: a proporção muda, e com ela a legibilidade impressa.

```
node scripts/mede-figuras.mjs
```

| Fig. | Arquivo | Conteúdo | Fonte útil |
|---:|---|---|---|
| 6 | `fig06-conceitual-producao` | Conceitual: da semente à muda pronta | 6,9 pt |
| 7 | `fig07-conceitual-comercial` | Conceitual: do cadastro ao pedido | 9,9 pt |
| 8 | `fig08-acesso` | Acesso e configurações, transversais às três áreas | 9,2 pt |
| 9 | `fig09-cadastros-especie` | Cadastros: a espécie e seus nomes | 8,7 pt |
| 10 | `fig10-cadastros-insumo-recipiente` | Cadastros: recipiente e insumo | 11,5 pt |
| 11 | `fig11-cadastros-viveiro` | Cadastros: área, canteiro e turno de trabalho | 12,5 pt |
| 12 | `fig12-cadastros-pessoas` | Cadastros: identidade única e papéis | 8,4 pt |
| 13 | `fig13-cadastros-tarefa-protocolo` | Cadastros: tipo de tarefa e protocolo de atividades | 8,7 pt |
| 14 | `fig14-producao-agenda` | Produção: semana, atribuição e participantes | 8,8 pt |
| 15 | `fig15-producao-lote` | Produção: o lote e seus movimentos | 9,0 pt |
| 16 | `fig16-producao-protocolo-do-lote` | Produção: o lote seguindo o protocolo | 22,6 pt |
| 17 | `fig17-comercial-pedido` | Comercial: pedido e item | 12,7 pt |

**A menor é a 6, a 6,9 pt, e é a conceitual da produção.** Continua sendo a mais apertada da série
pelo mesmo motivo de sempre: ela é a única que precisa mostrar o ciclo inteiro numa figura só, do
recipiente ao movimento do lote, passando pelo protocolo e pela agenda. Está acima do piso de 6 pt,
e em paisagem subiria para 10,3 pt caso a impressão fique ruim.

**As figuras posteriores do capítulo 4 deslocam.** São doze figuras de modelo de dados no lugar das
seis originais, então a arquitetura (4.6) passa a começar na Figura 18 e a segurança (4.7) na 24.

## Como conferir uma alteração

Duas divisões de figura, no histórico deste projeto, perderam relacionamentos em silêncio: as
arestas somem do desenho e o texto do `C6` passa a afirmar o que a figura não mostra. **A
conferência é um comando, e não uma lembrança:**

```bash
node scripts/confere-modelo-pt.mjs
```

Ele compara o **conjunto** de arestas das figuras lógicas (fig08 a fig17) com o das seções 3.1 a
3.4 do `C6`, nos dois sentidos. Até a renomeação ele também traduzia os nomes antes de comparar;
não traduz mais, porque os dois lados escrevem o mesmo nome.

> **Contar arestas não serve, e a versão anterior deste README mandava contar.** As figuras são um
> recorte mais fino que os quatro diagramas lógicos do `C6`, e aresta que cruza a fronteira de duas
> figuras aparece nas duas: `atribuicoes produz movimentos_lote` está em fig14 e em fig15. A soma
> das figuras é sempre maior que a do `C6`, e a conferência que nunca fecha é a que se para de
> rodar. O que tem de bater é o conjunto, não o total.

**A única aresta que o script aceita só nas figuras** é `lotes dá saldo a pedidos_itens`, em fig17:
é aresta de leitura e não de chave estrangeira, e está no `C6` §2, o conceitual. Ela aparece na
figura porque é o que o trabalho existe para demonstrar.

Para ver quais mudaram entre duas versões, em vez de comparar com o `C6`:

```bash
comm -23 \
  <(git show HEAD:docs/engenharia/modelo-dados-pt/mmd/figNN.mmd | grep '||--' | sed 's/  */ /g;s/^ //' | sort) \
  <(grep '||--' mmd/figNN.mmd | sed 's/  */ /g;s/^ //' | sort)
```

Saída vazia é o resultado esperado. Qualquer linha que apareça é um relacionamento perdido.

**Confira também contra o [`C6`](../C-modelagem/C6-modelo-entidade-relacionamento.md)**, e não só
contra a versão anterior: a alteração costuma acontecer junto com a entrada de entidade nova, e o
que o `C6` desenha e a figura não é a mesma falha por outro caminho.
