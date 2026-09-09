# Índice dos artefatos de engenharia

> Para entender a **estrutura de pastas** e o que esperar de cada uma, comece por
> [`README.md`](README.md). Este arquivo é o índice detalhado, com status e destino no TCC.
>
> Vai escrever os capítulos de **elicitação/análise de requisitos** e **regras de negócio**?
> O mapa do material já existente está em
> [`guia-cap-elicitacao-e-regras-de-negocio.md`](guia-cap-elicitacao-e-regras-de-negocio.md).
>
> Documentação formal de engenharia do projeto, produzida como base do **Capítulo 4 (Resultados)**
> do Trabalho de Conclusão de Curso *"Digitalização do fluxo operacional e comercial em viveiros
> florestais: um protótipo de sistema de gestão"* (UNIDAVI, 2026).
>
> Distinção em relação às demais pastas de `docs/`:
> - [`docs/rotinas/`](../rotinas/): documentação **de domínio**, escrita em linguagem de negócio, para quem opera.
> - `docs/engenharia/` (aqui): documentação **de engenharia**, formal, para a banca e para quem projeta.
> - [`plans/`](../../plans/): roadmaps de implementação, registro vivo do progresso.

## Convenção editorial

Os artefatos são redigidos **em tempo de projeto**, como especificação da solução a ser construída.
São documentos de projeto, não relatórios de código.

## Índice dos artefatos

### A: Fundação e escopo

| Código | Artefato | Destino no TCC | Situação |
|---|---|---|---|
| [A1](A-fundacao/A1-documento-de-visao.md) | Documento de Visão | 4.1 Visão geral da solução | ✅ escrito |
| [A2](A-fundacao/A2-glossario-dominio.md) | Glossário do domínio | Apêndice | ✅ escrito |

### B: Engenharia de requisitos

| Código | Artefato | Destino no TCC | Situação |
|---|---|---|---|
| [B2](B-requisitos/B2-especificacao-requisitos.md) | Especificação de Requisitos (ERS) | 4.2 Requisitos do sistema | ✅ escrito: 58 RF, 24 RNF |
| [B3](B-requisitos/B3-regras-de-negocio.md) | Regras de negócio e vínculo com os requisitos | 4.3 Regras de negócio | ✅ escrito: 54 regras, 55 dos 58 RF vinculados. **§4 e §7 geradas** por `scripts/build-b3-derivado.mjs` |
| [B4](B-requisitos/B4-quadros-tcc.md) | Quadros de regras de negócio e requisitos | Apêndice D | ✅ **gerado** por `scripts/build-b4-quadros.mjs`: 10 quadros |
| [B5](B-requisitos/B5-matriz-rastreabilidade.md) | Matriz de rastreabilidade | 4.10 + Apêndice | ✅ escrito: **§2 e §6 geradas** por `scripts/build-b5-matriz.mjs`; revelou 19 requisitos sem teste, todos fechados |

### C: Modelagem UML e de dados

| Código | Artefato | Destino no TCC | Situação |
|---|---|---|---|
| [C1](C-modelagem/C1-diagrama-casos-de-uso.md) | Diagrama de casos de uso | 4.4 Modelagem do sistema | ✅ escrito: 34 casos de uso, 3 atores |
| [C2](C-modelagem/C2-especificacao-casos-de-uso.md) | Especificação de casos de uso | 4.4 + Apêndice | ✅ escrito: 10 casos detalhados |
| [C6](C-modelagem/C6-modelo-entidade-relacionamento.md) | MER e DER | 4.5 Modelagem de dados | ✅ escrito: 27 entidades nas três áreas |
| [C8](C-modelagem/C8-dicionario-de-dados.md) | Dicionário de dados | 4.5 + Apêndice | ✅ escrito: 27 entidades + 2 visões |

### D: Arquitetura e decisões técnicas

| Código | Artefato | Destino no TCC | Situação |
|---|---|---|---|
| [D1](D-arquitetura/D1-arquitetura-c4.md) | Documento de arquitetura (C4) | 4.6 Arquitetura da solução | ✅ escrito: 3 níveis C4 |
| [D3](D-arquitetura/D3-diagrama-implantacao.md) | Diagrama de implantação | 4.6 Arquitetura da solução | ✅ escrito |
| [D4](D-arquitetura/D4-matriz-rbac.md) | Matriz RBAC | 4.7 Segurança e controle de acesso | ✅ escrito: 25 recursos, 3 perfis |

### E: Qualidade, riscos e segurança

| Código | Artefato | Destino no TCC | Situação |
|---|---|---|---|
| [E2](E-qualidade/E2-casos-de-teste-de-aceite.md) | Casos de teste de aceite | 4.8 + Apêndice | ✅ escrito: 67 casos; **§9 gerada** por `scripts/build-e2-cobertura.mjs` |
| [E3](E-qualidade/E3-analise-de-riscos.md) | Análise de riscos do projeto | **Capítulo 3** (metodologia) | ✅ escrito: 10 riscos |
| [E4](E-qualidade/E4-modelagem-de-ameacas.md) | Modelagem de ameaças e controles | 4.7 Segurança e controle de acesso | ✅ escrito: 11 ameaças |
| [E5](E-qualidade/E5-mapeamento-lgpd.md) | Mapeamento LGPD | 4.7 + parágrafos novos no Cap. 2.5 | ✅ escrito |
| [E6](E-qualidade/E6-plano-backup-recuperacao.md) | Plano de backup e recuperação | 4.7 + parágrafo novo no Cap. 2.5 | ✅ escrito |

### F: Usabilidade e experiência do usuário

| Código | Artefato | Destino no TCC | Situação |
|---|---|---|---|
| [F1](F-ux/F1-prototipo-de-telas.html) | Protótipo de telas (página HTML) | 4.4 + Apêndice | ✅ escrito: 35 pranchas, uma por caso de uso mais a entrada da Produção |
| [F3](F-ux/F3-plano-avaliacao-usabilidade.md) | Plano de avaliação de usabilidade | 4.8 Verificação e validação | ✅ escrito |

**Sobre o `F1`.** É o único artefato em HTML e não em Markdown, porque a peça *é* a tela: cada
prancha desenha o caso de uso na linguagem visual do app real (`globals.css`, `ModuleShell`) e traz
embaixo a ficha de engenharia, perfil autorizado, requisitos satisfeitos e se a tela já existe em
`src/app`. Abre no navegador direto do arquivo, e cada tela é um objeto de texto no array `S`,
identificado pelo código do caso de uso: alterar uma prancha é editar esse objeto, não redesenhar
a página.

Fontes, na ordem em que mandam: `C1` (casos de uso e áreas), `B2` (texto dos requisitos),
`B3` §3 e §4 (regras de negócio e o vínculo RF → RN) e `D4` §2 e §3 (matriz de permissão e as
dezesseis exceções). Mexeu em caso de uso, requisito, regra ou permissão, confira se a prancha
correspondente ainda descreve a tela certa.

**A conferência de 26/08/2026 fechou um furo declarado.** As pranchas tinham sido escritas a partir
de `C1` e `B2` apenas, com `B3` e `D4` citados como fonte sem terem sido lidos. A passagem
corrigiu **18 pranchas no perfil** e **10 na regra**. O achado que vale registrar: o `C1` nomeia o
*ator principal* do caso de uso e a matriz `D4` diz quem tem a permissão, e os dois **não são a
mesma coisa**. Ler o C1 como se fosse controle de acesso levava a erros como dar a tela de usuários
à chefia, que o `D4` §3.7 fecha para todo perfil de negócio. Nenhum dos dois documentos está errado;
quem escrever tela a partir de um só é que erra.

### G: Gestão do projeto e Business Intelligence

| Código | Artefato | Destino no TCC | Situação |
|---|---|---|---|
| [G2](G-gestao/G2-fichas-de-indicadores.md) | Fichas de indicador (KPI) | 4.9 Indicadores de desempenho | ✅ escrito: 3 indicadores, os que o mapa de lotes mostra |

---

## Fundamentação teórica por artefato

Cada artefato se apoia em um autor já presente no referencial teórico do TCC. A coluna existe para
que nenhuma afirmação do Capítulo 4 fique sem lastro no Capítulo 2.

| Autor | Fundamenta |
|---|---|
| **Sommerville (2011)** | A1, B2, B3, B5, C1, C2, D1, D3, D4, E4, E6 |
| **Elmasri e Navathe (2011)** | B3, C6, C8 |
| **Pressman e Maxim (2016)** | A1, C1, C2, E3 |
| **Nielsen (1993)** | F3 |
| **Sharda, Delen e Turban (2015)** | G2 |
| **Brasil (2018): Lei 13.709** | E5 *(referência a acrescentar ao Capítulo 2.5)* |

---

## Ordem de leitura

Para quem chega agora, a sequência que torna os artefatos compreensíveis:

1. **A2**: fixa o vocabulário. Todos os demais o utilizam.
2. **A1**: delimita o problema e o escopo.
3. **B2** (o que o sistema deve fazer, e **B3**) o que o negócio impõe, exista ou não o sistema.
4. **C1** e **C6**: quem faz o quê, e sobre quais dados.
5. Os demais, em qualquer ordem.
6. **B5** por último: amarra tudo e revela lacunas.

## Ordem de produção

`A2 → A1 → B2 → B3 → {C1, C6} → {C2, C8, D1, D3, D4, E2, E3, E4, E5, E6, F3, G2} → B5 → B4`

`B4` fica por último de propósito: ele **transcreve** `B2` e `B3`, e transcrever antes de a fonte
estar fechada é como o `.docx` de quadros ficou dois meses defasado.

**`modelo-dados-pt/` anda colado em `C6` e `C8`.** É o mesmo modelo com nomes em português, para as
figuras do trabalho, e **nenhum script o regenera**: quem altera entidade, atributo, chave ou
cardinalidade atualiza os três na mesma passada. Regra no [`CLAUDE.md`](../../CLAUDE.md) §Banco de
dados; instruções de renderização no [`README`](modelo-dados-pt/README.md) de lá.

## Entrega para o TCC

A pasta [`word/`](word/) reúne os arquivos destinados ao documento final, na ordem do Capítulo 4,
com os diagramas exportados em imagem. Ver [`word/00-como-montar.md`](word/00-como-montar.md).
