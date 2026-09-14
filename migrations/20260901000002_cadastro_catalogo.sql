-- Migration: 20260901000002_cadastro_catalogo.sql
-- Descricao: Catalogo de producao (especies, recipientes, insumos) e endereco do
--            viveiro (areas, canteiros), mais o periodo de trabalho (turnos_trabalho).
--
-- Requisitos: RF-08, RF-10 a RF-13 · Regras: RN-01 a RN-04, RN-07, RN-17, RN-27
-- Entidades: C8 `especies`, `especies_nomes_populares`, `especies_fotos`, `recipientes`,
--            `insumos`, `areas`, `canteiros`, `turnos_trabalho`
--
-- E O QUE NAO CONSOME NADA E ALIMENTA TUDO. Nenhuma tabela aqui tem chave
-- estrangeira para Producao nem para Comercial: as setas apontam sempre para ca.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TYPE categoria_insumo AS ENUM ('substrato', 'adubo', 'defensivo', 'recipiente', 'outros');

-- ------------------------------------------------------------
-- A especie: entidade central do modelo (RN-01)
-- ------------------------------------------------------------
CREATE TABLE especies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_cientifico TEXT NOT NULL UNIQUE,

  -- MULTIPLAS POR ESPECIE (RN-03): uma nativa pode ser ao mesmo tempo frutifera e
  -- madeireira, e forcar escolha unica falsearia o catalogo.
  caracteristicas TEXT[] NOT NULL DEFAULT '{}',

  -- Referencia no formato /api/fotos/<uuid>, que aponta para especies_fotos.
  foto_url        TEXT,

  observacoes     TEXT,
  ativa           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER especies_define_atualizado_em
  BEFORE UPDATE ON especies
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- A ESPECIE TEM NOMES, E NAO UM NOME (RF-10, RN-02). Um campo de texto com nomes
-- separados por virgula nao se indexa nem se valida.
CREATE TABLE especies_nomes_populares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  especie_id  UUID NOT NULL REFERENCES especies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  e_principal BOOLEAN NOT NULL DEFAULT false,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT especies_nomes_populares_unico UNIQUE (especie_id, nome)
);

-- Desnormalizacao declarada em C6 §4: evita subconsulta em toda listagem. O indice
-- garante o que a coluna promete.
CREATE UNIQUE INDEX especies_um_nome_primario
  ON especies_nomes_populares (especie_id) WHERE e_principal;

CREATE INDEX especies_nomes_populares_busca ON especies_nomes_populares (nome);

-- A FOTO E LINHA DE TABELA, E NAO ARQUIVO EM DISCO. O sistema de arquivos do
-- ambiente de publicacao e somente-leitura e e descartado a cada implantacao: a
-- imagem gravada em disco desapareceria na semana seguinte. Ganho colateral: entra
-- no mesmo backup do banco (E6).
CREATE TABLE especies_fotos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_conteudo TEXT NOT NULL,
  conteudo      BYTEA NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Recipiente e insumo
-- ------------------------------------------------------------
-- O RECIPIENTE DETERMINA O PORTE E O PRECO (RN-04), e e por ele que o protocolo de
-- atividades chega ao lote (RN-32).
CREATE TABLE recipientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL UNIQUE,
  volume_litros NUMERIC(6,3),
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER recipientes_define_atualizado_em
  BEFORE UPDATE ON recipientes
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- O INSUMO E CATALOGO, E NADA O CONSOME. Custo por unidade, historico de preco e
-- saldo em estoque sairam com o custeio: o que resta e a lista do que o viveiro
-- aplica, com unidade e categoria (RN-07).
CREATE TABLE insumos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           TEXT NOT NULL,
  categoria      categoria_insumo NOT NULL,
  unidade_medida TEXT NOT NULL,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER insumos_define_atualizado_em
  BEFORE UPDATE ON insumos
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- O endereco da muda dentro do viveiro (RN-17)
-- ------------------------------------------------------------
CREATE TABLE areas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letra         CHAR(1) NOT NULL UNIQUE,
  nome          TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT areas_letra_maiuscula CHECK (letra ~ '^[A-Z]$')
);

CREATE TRIGGER areas_define_atualizado_em
  BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

CREATE TABLE canteiros (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id       UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  numero        INTEGER NOT NULL,

  -- Existe para o AVISO de RN-29, e nao para recusar o lote: quem sabe se cabe e
  -- quem esta com a muda na mao.
  capacidade    INTEGER,

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- RF-13: a numeracao recomeca em cada area.
  CONSTRAINT canteiros_numero_unico_na_area UNIQUE (area_id, numero),
  CONSTRAINT canteiros_numero_positivo CHECK (numero > 0)
);

CREATE TRIGGER canteiros_define_atualizado_em
  BEFORE UPDATE ON canteiros
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- ------------------------------------------------------------
-- O periodo de trabalho
-- ------------------------------------------------------------
-- E ENTIDADE, E NAO CHAVE EM `parametros`, porque e uma LISTA DE COISAS COM
-- ATRIBUTOS (C6 §3.1). A tela dele, porem, mora em Configuracoes: o que muda de
-- lugar e a tela, nao a tabela. A duracao do turno sai daqui (RN-12, RN-27).
CREATE TABLE turnos_trabalho (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL UNIQUE,
  inicio        TIME NOT NULL,
  fim           TIME NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT turnos_trabalho_intervalo_valido CHECK (fim > inicio)
);

CREATE TRIGGER turnos_trabalho_define_atualizado_em
  BEFORE UPDATE ON turnos_trabalho
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

INSERT INTO turnos_trabalho (nome, inicio, fim) VALUES
  ('manha', '07:30', '11:30'),
  ('tarde', '13:00', '17:00');

COMMENT ON TABLE especies IS 'Especie botanica. Entidade central do modelo. RN-01.';
COMMENT ON TABLE especies_fotos IS 'Fotografia da especie, em bytes. Entra no backup do banco.';
COMMENT ON TABLE recipientes IS 'Recipiente. Determina o porte, o preco e o protocolo de manejo. RN-04, RN-32.';
COMMENT ON TABLE insumos IS 'Catalogo de insumos. Nada o consome no escopo atual. RN-07.';
COMMENT ON TABLE canteiros IS 'Canteiro. Um lote ocupa um canteiro; um canteiro comporta varios lotes. RN-19.';
COMMENT ON TABLE turnos_trabalho IS 'Turno de trabalho. A duracao sai daqui, e nao de constante. RN-27.';
