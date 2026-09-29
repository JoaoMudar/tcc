-- Migration: 20260929000001_viagens.sql
-- Descricao: A viagem de entrega, que junta varios pedidos num caminhao e diz a ordem das paradas.
--
-- Requisitos: RF-63, RF-64 · Regras: RN-59, RN-60
-- Entidades: C8 `viagens`, `viagens_paradas`, `cadastro.pessoas_enderecos`, `parametros`,
--            `pedidos_historico`
--
-- POR QUE ESTA MIGRATION EXISTE. A carga da 20260921000002 pertence a um pedido
-- so, e na pratica o caminhao sai com varios pedidos numa viagem. Quem carrega
-- precisa por por ultimo o que se entrega primeiro, e para isso precisa saber a
-- ordem das entregas antes de separar (plans/P14). A viagem guarda essa ordem e
-- a etapa em que o planejamento parou, para a pessoa sair e voltar sem perder
-- nada.
--
-- O QUE NAO ENTRA AQUI. Motorista, veiculo, capacidade e horario de saida: a
-- viagem termina quando a carga fica pronta, e a estrada continua fora do
-- sistema. A carga por pedido (`pedidos_cargas`) continua sendo o que se separa
-- e confere; a viagem so a organiza.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- ------------------------------------------------------------
-- 1. A viagem
-- ------------------------------------------------------------
CREATE TABLE viagens (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data               DATE NOT NULL,

  -- A partida e texto, e nao chave para os parametros: o endereco-base pode
  -- mudar em Configuracoes, e a viagem de ontem continua tendo saido de onde saiu.
  partida_descricao  TEXT NOT NULL,
  partida_lat        NUMERIC(9, 6),
  partida_lng        NUMERIC(9, 6),

  -- E TAMBEM A ETAPA ONDE A PESSOA PAROU. Montando e a Tela 1, roteirizando a
  -- Tela 2, carregando a Tela 3; pronta e a viagem com todas as cargas prontas.
  situacao           VARCHAR(20) NOT NULL DEFAULT 'montando',

  -- Verdadeiro quando o conjunto de paradas mudou desde a ultima sugestao, e a
  -- Tela 2 deve sugerir de novo ao abrir. A ordem arrumada a mao o desliga: sair
  -- para a Tela 1 e voltar nao pode desfazer o que a pessoa arrastou.
  sugerir_ordem      BOOLEAN NOT NULL DEFAULT true,

  -- Da rota sugerida pela API, na ordem sugerida. Nulos sem API, e zerados
  -- quando a ordem muda a mao: numero de outra ordem mentiria.
  distancia_m        INTEGER,
  duracao_s          INTEGER,

  criado_por         UUID NOT NULL REFERENCES usuarios(id),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT viagens_situacao_valida
    CHECK (situacao IN ('montando', 'roteirizando', 'carregando', 'pronta')),
  CONSTRAINT viagens_coordenada_inteira
    CHECK ((partida_lat IS NULL) = (partida_lng IS NULL)),
  CONSTRAINT viagens_rota_positiva
    CHECK (distancia_m IS NULL OR distancia_m >= 0),
  CONSTRAINT viagens_duracao_positiva
    CHECK (duracao_s IS NULL OR duracao_s >= 0)
);

CREATE INDEX viagens_data_idx ON viagens (data);

CREATE TRIGGER viagens_define_atualizado_em
  BEFORE UPDATE ON viagens
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

COMMENT ON TABLE viagens IS
  'Viagem de entrega do dia: os pedidos que vao no caminhao e a ordem das paradas. RF-63.';
COMMENT ON COLUMN viagens.situacao IS
  'montando, roteirizando, carregando ou pronta. E tambem a etapa em que o planejamento parou.';

-- ------------------------------------------------------------
-- 2. As paradas
-- ------------------------------------------------------------
-- UMA LINHA POR PARADA, NA ORDEM DA ROTA. A parada com pedido e uma entrega; a
-- avulsa ("abastecer em Rio do Sul") nao tem item e nao aparece no carregamento.
CREATE TABLE viagens_paradas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id  UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
  ordem      INTEGER NOT NULL,
  pedido_id  UUID REFERENCES pedidos(id),
  descricao  TEXT,
  endereco   TEXT,
  lat        NUMERIC(9, 6),
  lng        NUMERIC(9, 6),
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- DEFERIVEL: reordenar troca posicoes, e no meio da troca duas paradas tem o
  -- mesmo numero. A checagem espera o fim da transacao quando o codigo pede.
  CONSTRAINT viagens_paradas_ordem_unica UNIQUE (viagem_id, ordem) DEFERRABLE INITIALLY IMMEDIATE,
  CONSTRAINT viagens_paradas_pedido_unico UNIQUE (viagem_id, pedido_id),
  CONSTRAINT viagens_paradas_pedido_ou_descricao CHECK (pedido_id IS NOT NULL OR descricao IS NOT NULL),
  CONSTRAINT viagens_paradas_ordem_positiva CHECK (ordem > 0),
  CONSTRAINT viagens_paradas_coordenada_inteira CHECK ((lat IS NULL) = (lng IS NULL))
);

-- O que o CHECK nao alcanca, e fica com o codigo (`adicionarPedido`, travando o
-- pedido): um pedido so esta em uma viagem que ainda nao ficou pronta.
CREATE INDEX viagens_paradas_pedido_idx ON viagens_paradas (pedido_id) WHERE pedido_id IS NOT NULL;

COMMENT ON TABLE viagens_paradas IS
  'Parada da viagem, na ordem da rota. Com pedido e entrega; sem pedido e parada avulsa. RF-63.';
COMMENT ON COLUMN viagens_paradas.endereco IS
  'Endereco da parada avulsa. Na entrega, o endereco vem do cadastro do cliente.';

-- ------------------------------------------------------------
-- 3. Coordenada do endereco, guardada para nao consultar de novo
-- ------------------------------------------------------------
-- O endereco nao muda entre uma viagem e outra, e cada consulta a API de mapas
-- custa cota. A coordenada fica no endereco, e so vale para o texto de quando
-- foi consultada: o gatilho abaixo a apaga quando o texto muda.
ALTER TABLE cadastro.pessoas_enderecos
  ADD COLUMN lat              NUMERIC(9, 6),
  ADD COLUMN lng              NUMERIC(9, 6),
  ADD COLUMN geocodificado_em TIMESTAMPTZ,
  ADD CONSTRAINT pessoas_enderecos_coordenada_inteira CHECK ((lat IS NULL) = (lng IS NULL));

-- O cadastro hoje apaga e reinsere os enderecos, e a linha nova ja nasce sem
-- coordenada. O gatilho cobre o UPDATE que um dia alguem escrever.
CREATE FUNCTION cadastro.pessoas_enderecos_zera_coordenada() RETURNS trigger AS $$
BEGIN
  IF (NEW.logradouro, NEW.cidade, NEW.uf, NEW.cep) IS DISTINCT FROM
     (OLD.logradouro, OLD.cidade, OLD.uf, OLD.cep) THEN
    NEW.lat := NULL;
    NEW.lng := NULL;
    NEW.geocodificado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pessoas_enderecos_zera_coordenada
  BEFORE UPDATE ON cadastro.pessoas_enderecos
  FOR EACH ROW EXECUTE FUNCTION cadastro.pessoas_enderecos_zera_coordenada();

-- `geocodificado_em` preenchido com a coordenada nula e "a API procurou e nao
-- achou": o cartao da rota avisa, e o mesmo texto nao gasta outra consulta.
COMMENT ON COLUMN cadastro.pessoas_enderecos.lat IS
  'Latitude achada pela API de mapas para este texto. Apagada quando o endereco muda.';
COMMENT ON COLUMN cadastro.pessoas_enderecos.geocodificado_em IS
  'Quando a API de mapas foi consultada. Preenchido com lat nula: a API nao achou o endereco.';

-- ------------------------------------------------------------
-- 4. Os dois enderecos de partida
-- ------------------------------------------------------------
INSERT INTO parametros (chave, valor, tipo_valor, descricao) VALUES
  ('comercial.viagem_partida_agrolandia', 'Agrolândia, SC', 'texto',
   'Endereco de partida padrao da viagem de entrega (RF-64)'),
  ('comercial.viagem_partida_itapema', 'Itapema, SC', 'texto',
   'Segundo endereco de partida da viagem de entrega (RF-64)');

-- ------------------------------------------------------------
-- 5. A nota no historico do pedido
-- ------------------------------------------------------------
-- A 20260921000001 recusou linha de historico sem troca de situacao, porque
-- "linha que nao muda nada nao e historico". A data de entrega marcada no
-- planejamento da viagem muda o pedido sem mudar a situacao, e a ficha precisa
-- dizer quando e por que a data mudou. A regra continua valendo para a linha
-- vazia: sem troca de situacao, so entra com observacao.
ALTER TABLE pedidos_historico DROP CONSTRAINT pedidos_historico_muda_de_situacao;
ALTER TABLE pedidos_historico ADD CONSTRAINT pedidos_historico_muda_de_situacao
  CHECK (situacao_nova IS DISTINCT FROM situacao_anterior OR observacoes IS NOT NULL);
