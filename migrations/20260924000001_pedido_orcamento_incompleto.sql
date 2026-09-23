-- Migration: 20260924000001_pedido_orcamento_incompleto.sql
-- Descricao: O item do pedido nasce sem recipiente, e a conferencia responde o que falta.
--
-- Requisitos: RF-54, RF-56, RF-57
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. O pedido chega pelo WhatsApp de sete jeitos
-- (docs/rotinas/3-comercial/pedidos-como-chegam.md), e em quatro deles o
-- cliente nao diz o tamanho da muda ou nao diz quantas quer: "tem ipe e
-- aroeira?", "manda o que tiver de 17x22". Ate aqui o banco exigia o recipiente
-- no cadastro e a conferencia so sabia responder sobre um numero ja pedido.
-- Agora o cadastro exige so a especie (ou a descricao, no generico), a
-- gerencia responde quantas tem e em que recipiente, e quem exige tudo e a
-- aprovacao, que e codigo (`confirmarPedido`).
--
-- A ORDEM DESTE ARQUIVO E OBRIGATORIA, como em 20260921000001: soltar as
-- constraints, migrar as linhas, so entao prender as novas.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos_itens ALTER COLUMN recipiente_id DROP NOT NULL;

COMMENT ON COLUMN pedidos_itens.recipiente_id IS
  'Recipiente pedido. Nulo e "o cliente nao disse o tamanho"; a conferencia responde em qual existe, e a aprovacao o exige. RF-54.';

ALTER TABLE pedidos_itens DROP CONSTRAINT pedidos_itens_disponibilidade_coerente;
ALTER TABLE pedidos_itens DROP CONSTRAINT pedidos_itens_recipiente_disponivel_com_muda;

-- Resposta gravada sobre item que perdeu a quantidade depois (o pedido voltou
-- ao cadastro e a chefia apagou o numero) nao responde mais a pergunta de
-- ninguem: volta a ser item por conferir. O generico fica de fora, porque a
-- resposta dele e a composicao, e nao um numero.
UPDATE pedidos_itens
   SET disponivel = NULL, quantidade_disponivel = NULL, recipiente_disponivel_id = NULL
 WHERE quantidade IS NULL AND NOT generico AND disponivel IS NOT NULL;

-- O generico precisa dizer o que foi pedido, senao a gerencia compoe um item
-- que ninguem sabe o que era. O banco pode ter algum sem texto, de antes.
UPDATE pedidos_itens SET especificacao = 'Mudas nativas' WHERE generico AND especificacao IS NULL;

-- TRES FORMAS DE RESPOSTA, conforme o que o item pedia:
--   * sem resposta: tudo nulo;
--   * item com quantidade: "tem tudo" (true, sem numero) ou "tem so isto"
--     (false, de 0 a quantidade - 1), como antes;
--   * item sem quantidade: a gerencia diz quantas tem, e `disponivel` e so
--     "tem alguma" (350 e true, 0 e false). E o "tenho 350" do tipo 1.
-- O generico composto fica respondido com true e sem numero, com ou sem
-- quantidade: o que ele tem e dito pelos filhos.
ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_disponibilidade_coerente CHECK (
  (disponivel IS NULL AND quantidade_disponivel IS NULL)
  OR (generico AND disponivel = true AND quantidade_disponivel IS NULL)
  OR (quantidade IS NOT NULL AND (
        (disponivel = true AND quantidade_disponivel IS NULL)
        OR (disponivel = false AND quantidade_disponivel BETWEEN 0 AND quantidade - 1)))
  OR (quantidade IS NULL AND quantidade_disponivel IS NOT NULL AND quantidade_disponivel >= 0
      AND disponivel = (quantidade_disponivel > 0))
);

-- "Tem tudo, em 17x22" passa a caber: o recipiente conferido acompanha
-- qualquer resposta com muda, inclusive a que nao grava numero. So "nao tem
-- nenhuma" continua sem recipiente, que e o sentido de antes.
ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_recipiente_disponivel_com_muda CHECK (
  recipiente_disponivel_id IS NULL OR quantidade_disponivel IS DISTINCT FROM 0
);

ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_generico_com_especificacao CHECK (
  NOT generico OR especificacao IS NOT NULL
);
