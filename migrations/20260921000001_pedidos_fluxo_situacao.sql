-- Migration: 20260921000001_pedidos_fluxo_situacao.sql
-- Descricao: O pedido passa a percorrer oito situacoes, e toda mudanca fica registrada.
--
-- Requisitos: RF-57 · Regras: RN-48, RN-52
-- Entidades: C8 `pedidos`, `pedidos_historico`
--
-- POR QUE ESTA MIGRATION EXISTE. A 20260901000006 declarou tres situacoes
-- (`rascunho`, `confirmado`, `cancelado`), que descreviam um comercial sem
-- conferencia e sem separacao: a chefia registrava e confirmava, e o que
-- acontecia no viveiro entre uma coisa e outra nao entrava no sistema. A rotina
-- real tem duas etapas a mais, e cada uma tem dono: a gerencia confere a
-- disponibilidade no patio, e a chefia aprova o que vai ser vendido.
--
-- O QUE MUDA NO ESTADO. `rascunho` vira `cadastrado`, porque o pedido ja nasce
-- pronto para a conferencia e nao e rascunho de nada; `confirmado` vira
-- `aprovado`, que e o nome do ato da chefia no fluxo novo. `cancelado` fica.
--
-- A ORDEM DESTE ARQUIVO E OBRIGATORIA: soltar a constraint antiga, migrar as
-- linhas, so entao trocar o DEFAULT e prender a constraint nova. Prender antes
-- de migrar falha em qualquer banco que tenha uma linha `rascunho`, e passa em
-- banco vazio, que e o jeito de o defeito escapar do teste.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos DROP CONSTRAINT pedidos_situacao_valida;

UPDATE pedidos SET situacao = 'cadastrado' WHERE situacao = 'rascunho';
UPDATE pedidos SET situacao = 'aprovado'   WHERE situacao = 'confirmado';

ALTER TABLE pedidos ALTER COLUMN situacao SET DEFAULT 'cadastrado';

-- A lista fechada continua no banco, e nao so no TypeScript: e a mesma decisao
-- da RN-42 para canal de venda. Um teste le esta constraint e a compara com
-- SITUACOES_PEDIDO, para as duas listas nao divergirem em silencio.
ALTER TABLE pedidos ADD CONSTRAINT pedidos_situacao_valida CHECK (situacao IN (
  'cadastrado', 'verificando', 'verificado', 'pendente_alteracao',
  'aprovado', 'separando', 'pronto_envio', 'cancelado'
));

-- NULO E "NINGUEM PERGUNTOU AINDA", e por isso a coluna nao e NOT NULL DEFAULT
-- false: os pedidos que ja existem nunca passaram pela pergunta da nota fiscal,
-- e grava-los como `false` seria afirmar uma resposta que ninguem deu. A
-- pergunta acontece na aprovacao, e so ali a coluna ganha valor.
ALTER TABLE pedidos ADD COLUMN precisa_nota BOOLEAN;

COMMENT ON COLUMN pedidos.precisa_nota IS
  'Se o pedido sai com nota fiscal. NULO enquanto a chefia nao respondeu, na aprovacao.';

-- ------------------------------------------------------------
-- O historico de situacao (RN-52: todo registro tem autor)
-- ------------------------------------------------------------
-- A 20260901000006 dispensou o historico com o argumento de que quem mudou o
-- que e quando e pergunta que um viveiro de nove pessoas resolve perguntando.
-- Isso valia para duas transicoes feitas pela mesma pessoa. Com oito situacoes
-- e dois perfis se revezando, o pedido passa de mao em mao, e "a gerencia ja
-- conferiu?" deixa de ter resposta obvia. O historico e a resposta.
CREATE TABLE pedidos_historico (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id         UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,

  -- NULO no nascimento do pedido: nao ha situacao anterior a primeira.
  situacao_anterior VARCHAR(30),
  situacao_nova     VARCHAR(30) NOT NULL,

  alterado_por      UUID NOT NULL REFERENCES usuarios(id),

  -- Motivo do pedido de alteracao, resumo da aprovacao parcial, e o que mais a
  -- transicao precisar dizer em uma linha.
  observacoes       TEXT,

  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Linha que nao muda nada nao e historico, e entraria so para poluir a ficha.
  CONSTRAINT pedidos_historico_muda_de_situacao
    CHECK (situacao_nova IS DISTINCT FROM situacao_anterior)
);

CREATE INDEX pedidos_historico_pedido_idx ON pedidos_historico (pedido_id, criado_em);

-- BACKFILL SINTETICO. Sem ele, o pedido que ja existia abriria a ficha com um
-- historico vazio, e a tela precisaria de um caso especial para "pedido antigo
-- nao tem historico". Uma linha por pedido, com a situacao em que ele esta, o
-- autor do cadastro e a hora do cadastro: e a verdade que o banco tem sobre
-- eles, e nao uma invencao de transicoes que ninguem registrou.
INSERT INTO pedidos_historico (pedido_id, situacao_anterior, situacao_nova, alterado_por, observacoes, criado_em)
SELECT p.id, NULL, p.situacao, p.criado_por, 'Situacao migrada do fluxo de tres situacoes.', p.criado_em
  FROM pedidos p;

COMMENT ON TABLE pedidos_historico IS
  'Mudanca de situacao do pedido, com autor e data. RF-57, RN-52.';
