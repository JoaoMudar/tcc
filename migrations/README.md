# Migrations

SQL puro, aplicado em ordem pelo nome (`npm run db:migrate`, `src/lib/migrations/runner.ts`). Cada
arquivo roda uma vez por banco, e a tabela de controle guarda quais já rodaram.

## Regras

1. **Migration aplicada não se edita.** Correção é migration nova. O comentário de uma migration
   antiga só muda em banco recriado; num banco existente, o `COMMENT ON` antigo continua.
2. **Nome**: `AAAAMMDDNNNNNN_descricao_curta.sql`, com o cabeçalho que diz o porquê, os requisitos e
   as entidades do C8 tocadas.
3. **Compatível com a versão anterior do código** (RNF-23). O código publicado continua rodando
   enquanto a migration nova já está aplicada, e o deploy não é atômico. Por isso a mudança que
   tira ou renomeia coisa é feita em duas etapas, **expandir e contrair**:
   - *expandir*: criar a coluna (ou tabela) nova e copiar o dado nela numa migration; o código novo
     passa a gravar e ler a nova;
   - *contrair*: só numa migration **posterior**, depois que o código que lia a antiga saiu de
     produção, apagar a coluna antiga.

   `RENAME COLUMN` e `DROP COLUMN` direto numa migration só, junto com o código que muda, quebram
   a versão que ainda está no ar. Duas migrations antigas fizeram isso
   (`20260918000001`, `RENAME COLUMN data_plantio TO data_criacao`; `20260930000003`,
   `DROP COLUMN publicada_por`) e ficam como estão: a regra vale daqui em diante.
4. **Coluna nova é nula, ou tem valor padrão.** Restrição nova sobre dado existente usa `NOT VALID`
   quando o dado antigo pode não cumpri-la.
5. Mexeu em entidade, atributo, chave ou cardinalidade: atualizar `C6`, `C8` e `modelo-dados-pt` na
   mesma alteração, e registrar no `CHANGELOG.md`.
