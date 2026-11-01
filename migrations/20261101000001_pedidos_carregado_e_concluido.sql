-- Migration: 20261101000001_pedidos_carregado_e_concluido.sql
-- Descricao: O pedido ganha as situacoes carregado e concluido.
--
-- Requisitos: RF-61 · Regras: RN-55, RN-64
-- Entidades: C8 `pedidos`, `pedidos_historico`
--
-- POR QUE ESTA MIGRATION EXISTE. O fluxo terminava em `pronto_envio`, que tambem
-- era o estado do pedido so separado ao lado do carro. O pedido ja carregado, e
-- ate o ja entregue, continuava dizendo "pronto para envio". Agora a viagem
-- pronta leva o pedido a `carregado`, e passada a data da viagem ele fica
-- `concluido`. Essa ultima passagem e do codigo (`concluirEntregasPassadas`),
-- que grava o historico; por isso esta migration nao conclui ninguem.
--
-- O QUE MUDA NOS DADOS. O pedido `pronto_envio` de viagem ja pronta vai a
-- `carregado`, com linha no historico. O autor e quem o deixou pronto para envio.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

ALTER TABLE pedidos DROP CONSTRAINT pedidos_situacao_valida;

ALTER TABLE pedidos ADD CONSTRAINT pedidos_situacao_valida CHECK (situacao IN (
  'cadastrado', 'verificando', 'verificado', 'pendente_alteracao',
  'aprovado', 'separando', 'pronto_envio', 'carregado', 'concluido', 'cancelado'
));

WITH carregados AS (
  UPDATE pedidos p
     SET situacao = 'carregado'
    FROM viagens_paradas vp
    JOIN viagens v ON v.id = vp.viagem_id
   WHERE vp.pedido_id = p.id AND v.situacao = 'pronta' AND p.situacao = 'pronto_envio'
  RETURNING p.id, p.criado_por
)
INSERT INTO pedidos_historico (pedido_id, situacao_anterior, situacao_nova, alterado_por, observacoes)
SELECT c.id, 'pronto_envio', 'carregado',
       COALESCE((SELECT h.alterado_por FROM pedidos_historico h
                  WHERE h.pedido_id = c.id AND h.situacao_nova = 'pronto_envio'
                  ORDER BY h.criado_em DESC, h.id DESC LIMIT 1), c.criado_por),
       'Situacao ajustada: a viagem deste pedido ja estava carregada.'
  FROM carregados c;
