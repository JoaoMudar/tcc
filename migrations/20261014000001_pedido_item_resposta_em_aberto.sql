-- Migration: 20261014000001_pedido_item_resposta_em_aberto.sql
-- Descricao: A conferencia guarda o botao tocado ("Tem", "Tem parte") enquanto falta campo obrigatorio.
--
-- Requisitos: RF-63
-- Entidades: C8 `pedidos_itens`
--
-- POR QUE ESTA MIGRATION EXISTE. A gerencia toca "Tem" num item cujo cliente
-- nao disse o recipiente, e a resposta so grava quando o recipiente vem. Ate
-- aqui o toque pintava o cartao e nao gravava nada: quem saia pelo "Salvar" e
-- voltava depois encontrava o item com a resposta anterior ("Nao tem"), como se
-- nao tivesse tocado. A coluna guarda o botao tocado, e o item reabre nele, com
-- os campos a preencher.
--
-- EM ABERTO E PENDENTE. A resposta anterior deixou de ser verdade quando a
-- pessoa tocou outro botao, e cai: as colunas da resposta ficam nulas, e a
-- conclusao continua recusando o item como nao conferido. Responder de verdade
-- apaga a marca.
--
-- Compatibilidade: coluna nova e nulavel; nenhuma linha muda de sentido.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos_itens
  ADD COLUMN resposta_em_aberto TEXT
    CONSTRAINT pedidos_itens_resposta_em_aberto_valida CHECK (resposta_em_aberto IN ('disponivel', 'parcial'));

ALTER TABLE pedidos_itens ADD CONSTRAINT pedidos_itens_resposta_em_aberto_pendente CHECK (
  resposta_em_aberto IS NULL OR disponivel IS NULL
);

COMMENT ON COLUMN pedidos_itens.resposta_em_aberto IS
  'Botao tocado na conferencia ("disponivel" e "Tem", "parcial" e "Tem parte") que ainda nao grava por falta de campo obrigatorio. So com o item pendente; responder apaga. RF-63.';
