-- Migration: 20261006000002_viagem_volta_e_frete_outro.sql
-- Descricao: A volta da viagem e o endereco digitado como saida do frete.
--
-- Requisitos: RF-63, RF-67 · Regras: RN-64
-- Entidades: C8 `viagens`, `pedidos`
--
-- POR QUE ESTA MIGRATION EXISTE. A rota da viagem era aberta: saia do viveiro e
-- terminava na ultima entrega. O caminhao volta, e volta nem sempre para onde
-- saiu (sai de Agrolandia, dorme em Itapema). Sem a volta, a ordem sugerida, o
-- km e o tempo ignoravam o trecho final.
--
-- A VOLTA NULA E A VOLTA IGUAL A SAIDA. Assim a viagem que ja existe passa a
-- voltar para onde saiu, e trocar a saida leva a volta junto ate alguem
-- escolher outra. A coordenada segue a regra da partida: vem com o endereco
-- escolhido na lista, ou e procurada pelo texto na hora da sugestao.
--
-- O FRETE GANHA A SAIDA DIGITADA. Alem de Agrolandia e Itapema, a chefia pode
-- sugerir o frete saindo de um endereco qualquer. O texto fica no pedido, para
-- a ficha reabrir mostrando de onde veio a conta.
--
-- Compatibilidade: colunas novas, todas nulaveis; a regra da origem do frete
-- so ganha um valor.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- ------------------------------------------------------------
-- 1. A volta da viagem
-- ------------------------------------------------------------
ALTER TABLE viagens
  ADD COLUMN chegada_descricao TEXT,
  ADD COLUMN chegada_lat       NUMERIC(9, 6),
  ADD COLUMN chegada_lng       NUMERIC(9, 6),
  ADD CONSTRAINT viagens_chegada_coordenada_inteira CHECK ((chegada_lat IS NULL) = (chegada_lng IS NULL)),
  ADD CONSTRAINT viagens_chegada_coordenada_com_texto CHECK (chegada_descricao IS NOT NULL OR chegada_lat IS NULL);

COMMENT ON COLUMN viagens.chegada_descricao IS
  'Onde o caminhao termina a viagem. Nulo e "volta para onde saiu".';

-- ------------------------------------------------------------
-- 2. O endereco digitado como saida do frete
-- ------------------------------------------------------------
ALTER TABLE pedidos
  DROP CONSTRAINT pedidos_frete_origem_valida,
  ADD CONSTRAINT pedidos_frete_origem_valida
    CHECK (frete_origem IS NULL OR frete_origem IN ('agrolandia', 'itapema', 'outro')),
  ADD COLUMN frete_origem_endereco TEXT,
  ADD CONSTRAINT pedidos_frete_endereco_so_no_outro
    CHECK (frete_origem_endereco IS NULL OR frete_origem = 'outro'),
  ADD CONSTRAINT pedidos_frete_outro_com_endereco
    CHECK (frete_origem IS DISTINCT FROM 'outro' OR frete_origem_endereco IS NOT NULL);

COMMENT ON COLUMN pedidos.frete_origem IS
  'De onde parte a conta do frete: agrolandia, itapema ou outro, um endereco digitado.';
COMMENT ON COLUMN pedidos.frete_origem_endereco IS
  'O endereco de saida digitado, quando a origem do frete e outro.';
