# Cadastro único de pessoas

> Uma identidade, vários papéis. Cliente, fornecedor e funcionário não são três cadastros: são
> três papéis da mesma pessoa (RN-47).
>
> Modelo em [`C6`](../../engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md) e
> [`C8`](../../engenharia/C-modelagem/C8-dicionario-de-dados.md); origem no banco em
> `migrations/20260901000003_cadastro_pessoas_e_tarefas.sql`.

## O problema que ele resolve

Quem vende semente ao viveiro às vezes compra muda dele. Com um cadastro de cliente e outro de
fornecedor, essa pessoa aparece duas vezes, e o mesmo telefone passa a ter duas verdades. Pior:
não há como perguntar quanto se comprou e quanto se vendeu para ela sem casar os dois cadastros
por nome a cada consulta.

**A identidade é uma só, e o papel é que se multiplica.** É o que RN-47 afirma e o que as três
tabelas do esquema `cadastro` implementam.

## As três tabelas

```
cadastro.pessoas             quem é: tipo, nome, documento, telefone, e-mail
cadastro.pessoas_papeis      cliente · fornecedor · funcionario, com o vínculo do funcionário
cadastro.pessoas_enderecos   entrega · cobranca · residencial
```

### `cadastro.pessoas`

| Coluna | Nota |
|---|---|
| `tipo` | `pf` ou `pj`, pelo enum `cadastro.tipo_pessoa` |
| `nome` | obrigatório, e é o rótulo que a tela exibe |
| `documento` | CPF ou CNPJ, só dígitos, único. **Nulo no cadastro rápido** |
| `telefone`, `email`, `observacoes` | opcionais |
| `ativa` | inativar retira a pessoa das listas e preserva o histórico |

**`documento` é nulo até que precise não ser.** A negociação nasce no WhatsApp e o cliente
frequentemente é novo, então nome e telefone bastam para registrar o pedido, e a ficha se completa
depois (RN-46, RF-15). A unicidade do documento é índice de banco, e vale só quando ele existe.

O conjunto fiscal completo é exigência de quem emite a nota, não deste sistema: a nota é emitida
em sistema externo, e aqui fica apenas o cadastro capaz de alimentá-la (RN-45, RF-16).

### `cadastro.pessoas_papeis`

Chave primária composta por `pessoa_id` e `papel`, o que impede o mesmo papel duas vezes na mesma
pessoa. `tipo_vinculo` (`fixo` ou `diarista`) só é aceito no papel `funcionario`, e a restrição
`pessoas_papeis_vinculo_so_em_funcionario` é quem garante isso. A coluna vive no papel, e não em
`pessoas`, para não deixar nula em toda pessoa que só compra.

**Funcionário existe sem login.** A chave estrangeira `usuarios.pessoa_id` é opcional nos dois
sentidos, porque há administrador sem vínculo e há funcionário sem acesso ao sistema. Seis dos
nove colaboradores nunca abrem o aplicativo, e mesmo assim aparecem na agenda (RF-20).

### `cadastro.pessoas_enderecos`

`logradouro`, `cidade`, `uf` e `cep`, com o tipo pelo enum `cadastro.tipo_endereco`. Uma pessoa
tem mais de um endereço, e o de entrega pode não ser o de cobrança (RN-51).

## Como a tela usa isso

`/cadastros/pessoas` é **uma lista com filtro por papel**, e não uma aba por papel. A pessoa
aparece uma vez, com um selo por papel que ela exerce, e o selo é o link para a tela daquele papel.
O nome abre a ficha, que mostra a identidade e o histórico dos dois lados, e não edita nada.

A busca localiza por nome, telefone ou documento, e indica os papéis (RF-18).

**O papel não se esconde; a ficha fiscal, sim.** Pessoas é um recurso só na matriz de acesso, e
separar a leitura de cliente da de fornecedor exigiria uma permissão por papel sobre a mesma linha
(`D4` §2, nota 2). O que a gerência não lê é CPF, CNPJ e endereço, que é a única restrição de
privacidade da matriz (`D4` §3.1).

## Rastreabilidade

| Documento | O que |
|---|---|
| [`B2`](../../engenharia/B-requisitos/B2-especificacao-requisitos.md) | RF-14 a RF-20 |
| [`B3`](../../engenharia/B-requisitos/B3-regras-de-negocio.md) | RN-45, RN-46, RN-47, RN-51 |
| [`C6`](../../engenharia/C-modelagem/C6-modelo-entidade-relacionamento.md) / [`C8`](../../engenharia/C-modelagem/C8-dicionario-de-dados.md) | `cadastro.pessoas`, `cadastro.pessoas_papeis`, `cadastro.pessoas_enderecos` |
| [`D4`](../../engenharia/D-arquitetura/D4-matriz-rbac.md) | recursos **Pessoas** e **Dados fiscais de pessoa** |
