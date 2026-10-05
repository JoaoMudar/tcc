-- Migration: 20261005000001_pedido_frete_e_peso.sql
-- Descricao: Peso do recipiente cheio, frete do pedido e coordenada que acompanha o texto do endereco.
--
-- Requisitos: RF-55, RF-67, RF-64 · Regras: RN-64, RN-65
-- Entidades: C8 `recipientes`, `pedidos`, `parametros`, `cadastro.pessoas_enderecos`
--
-- POR QUE ESTA MIGRATION EXISTE. Na aprovacao a chefia fecha o preco com o
-- cliente, e o cliente pergunta duas coisas que a ficha nao respondia: quanto
-- fica o frete e quanto pesa a carga. O frete e um valor do pedido, e nao de um
-- item, e o peso sai do recipiente: a muda em saco 20x26 pesa o que pesa o saco
-- cheio de substrato, qualquer que seja a especie.
--
-- O FRETE E SUGERIDO, E NUNCA IMPOSTO (RN-64). A sugestao e a distancia de ida
-- e volta ate o cliente, dividida pelo consumo do caminhao e multiplicada pelo
-- preco do litro. O valor gravado e o que a chefia digitou, mesmo que destoe da
-- conta: o frete se negocia como o preco. `frete_distancia_km` guarda so a
-- distancia da ultima sugestao, para a ficha mostrar de onde veio o numero.
--
-- O PRECO DO LITRO E PARAMETRO POR ENQUANTO. O insumo nao tem preco no escopo
-- atual (RN-07); quando tiver, o parametro da lugar ao custo da gasolina.
--
-- A COORDENADA PASSA A PODER SER GRAVADA JUNTO DO TEXTO. A 20260929000001 apaga
-- a coordenada quando o texto do endereco muda, porque ela foi achada para o
-- texto antigo. Agora a pessoa cola a localizacao que o cliente mandou pelo
-- WhatsApp e corrige o texto no mesmo gesto, e o gatilho apagaria o ponto que
-- acabou de chegar. A regra fica: o texto mudou e a coordenada nao, apaga.
--
-- Compatibilidade: colunas novas, todas nulaveis; parametros novos; a funcao
-- do gatilho e substituida mantendo o nome.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- ------------------------------------------------------------
-- 1. Peso do recipiente cheio
-- ------------------------------------------------------------
ALTER TABLE recipientes
  ADD COLUMN peso_kg NUMERIC(6, 3),
  ADD CONSTRAINT recipientes_peso_positivo CHECK (peso_kg IS NULL OR peso_kg > 0);

COMMENT ON COLUMN recipientes.peso_kg IS
  'Peso aproximado do recipiente cheio de substrato, com a muda, em kg. Base do peso estimado da carga (RN-65).';

-- ------------------------------------------------------------
-- 2. Frete do pedido
-- ------------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN frete              NUMERIC(10, 2),
  ADD COLUMN frete_origem       TEXT,
  ADD COLUMN frete_distancia_km NUMERIC(7, 1),
  ADD CONSTRAINT pedidos_frete_nao_negativo CHECK (frete IS NULL OR frete >= 0),
  ADD CONSTRAINT pedidos_frete_origem_valida CHECK (frete_origem IS NULL OR frete_origem IN ('agrolandia', 'itapema')),
  ADD CONSTRAINT pedidos_frete_distancia_positiva CHECK (frete_distancia_km IS NULL OR frete_distancia_km > 0);

COMMENT ON COLUMN pedidos.frete IS
  'Frete combinado com o cliente, em reais. Nulo e "sem frete". Sugerido pela distancia, gravado o que foi digitado (RN-64).';
COMMENT ON COLUMN pedidos.frete_origem IS
  'De onde parte a conta do frete: agrolandia ou itapema, os dois enderecos de partida da viagem.';
COMMENT ON COLUMN pedidos.frete_distancia_km IS
  'Distancia de ida, em km, da ultima sugestao de frete. So informa de onde veio o numero.';

-- ------------------------------------------------------------
-- 3. Os parametros da conta do frete
-- ------------------------------------------------------------
INSERT INTO parametros (chave, valor, tipo_valor, descricao) VALUES
  ('comercial.frete_km_por_litro', '17', 'numero',
   'Consumo do caminhao de entrega, em km por litro, para sugerir o frete (RN-64)'),
  ('comercial.frete_preco_litro', '7', 'numero',
   'Preco do litro de gasolina, em reais, para sugerir o frete. Futuramente vira do insumo gasolina (RN-64)');

-- ------------------------------------------------------------
-- 4. A coordenada que chega junto do texto fica
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION cadastro.pessoas_enderecos_zera_coordenada() RETURNS trigger AS $$
BEGIN
  IF (NEW.logradouro, NEW.cidade, NEW.uf, NEW.cep) IS DISTINCT FROM
     (OLD.logradouro, OLD.cidade, OLD.uf, OLD.cep)
     AND (NEW.lat, NEW.lng) IS NOT DISTINCT FROM (OLD.lat, OLD.lng) THEN
    NEW.lat := NULL;
    NEW.lng := NULL;
    NEW.geocodificado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
