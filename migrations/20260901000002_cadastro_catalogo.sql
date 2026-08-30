-- Migration: 20260901000002_cadastro_catalogo.sql
-- Descricao: Catalogo de producao (species, containers, inputs) e endereco do
--            viveiro (areas, beds), mais o periodo de trabalho (work_shifts).
--
-- Requisitos: RF-08, RF-10 a RF-13 · Regras: RN-01 a RN-04, RN-07, RN-17, RN-27
-- Entidades: C8 `species`, `species_popular_names`, `species_photos`, `containers`,
--            `inputs`, `areas`, `beds`, `work_shifts`
--
-- E O QUE NAO CONSOME NADA E ALIMENTA TUDO. Nenhuma tabela aqui tem chave
-- estrangeira para Producao nem para Comercial: as setas apontam sempre para ca.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TYPE input_category AS ENUM ('substrato', 'adubo', 'defensivo', 'recipiente', 'outros');

-- ------------------------------------------------------------
-- A especie: entidade central do modelo (RN-01)
-- ------------------------------------------------------------
CREATE TABLE species (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scientific_name TEXT NOT NULL UNIQUE,

  -- MULTIPLAS POR ESPECIE (RN-03): uma nativa pode ser ao mesmo tempo frutifera e
  -- madeireira, e forcar escolha unica falsearia o catalogo.
  tags            TEXT[] NOT NULL DEFAULT '{}',

  -- Referencia no formato /api/fotos/<uuid>, que aponta para species_photos.
  photo_url       TEXT,

  notes           TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER species_set_updated_at
  BEFORE UPDATE ON species
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A ESPECIE TEM NOMES, E NAO UM NOME (RF-10, RN-02). Um campo de texto com nomes
-- separados por virgula nao se indexa nem se valida.
CREATE TABLE species_popular_names (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id UUID NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT species_popular_names_unico UNIQUE (species_id, name)
);

-- Desnormalizacao declarada em C6 §4: evita subconsulta em toda listagem. O indice
-- garante o que a coluna promete.
CREATE UNIQUE INDEX species_um_nome_primario
  ON species_popular_names (species_id) WHERE is_primary;

CREATE INDEX species_popular_names_busca ON species_popular_names (name);

-- A FOTO E LINHA DE TABELA, E NAO ARQUIVO EM DISCO. O sistema de arquivos do
-- ambiente de publicacao e somente-leitura e e descartado a cada implantacao: a
-- imagem gravada em disco desapareceria na semana seguinte. Ganho colateral: entra
-- no mesmo backup do banco (E6).
CREATE TABLE species_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content      BYTEA NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Recipiente e insumo
-- ------------------------------------------------------------
-- O RECIPIENTE DETERMINA O PORTE E O PRECO (RN-04), e e por ele que o protocolo de
-- atividades chega ao lote (RN-34).
CREATE TABLE containers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  volume_liters NUMERIC(6,3),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER containers_set_updated_at
  BEFORE UPDATE ON containers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- O INSUMO E CATALOGO, E NADA O CONSOME. Custo por unidade, historico de preco e
-- saldo em estoque sairam com o custeio: o que resta e a lista do que o viveiro
-- aplica, com unidade e categoria (RN-07).
CREATE TABLE inputs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        input_category NOT NULL,
  unit_of_measure TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER inputs_set_updated_at
  BEFORE UPDATE ON inputs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- O endereco da muda dentro do viveiro (RN-17)
-- ------------------------------------------------------------
CREATE TABLE areas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter     CHAR(1) NOT NULL UNIQUE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT areas_letra_maiuscula CHECK (letter ~ '^[A-Z]$')
);

CREATE TRIGGER areas_set_updated_at
  BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE beds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id    UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  number     INTEGER NOT NULL,

  -- Existe para o AVISO de RN-30, e nao para recusar o lote: quem sabe se cabe e
  -- quem esta com a muda na mao.
  capacity   INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- RF-13: a numeracao recomeca em cada area.
  CONSTRAINT beds_numero_unico_na_area UNIQUE (area_id, number),
  CONSTRAINT beds_numero_positivo CHECK (number > 0)
);

CREATE TRIGGER beds_set_updated_at
  BEFORE UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- O periodo de trabalho
-- ------------------------------------------------------------
-- E ENTIDADE, E NAO CHAVE EM `settings`, porque e uma LISTA DE COISAS COM
-- ATRIBUTOS (C6 §3.1). A tela dele, porem, mora em Configuracoes: o que muda de
-- lugar e a tela, nao a tabela. A duracao do turno sai daqui (RN-12, RN-27).
CREATE TABLE work_shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  starts_at  TIME NOT NULL,
  ends_at    TIME NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT work_shifts_intervalo_valido CHECK (ends_at > starts_at)
);

CREATE TRIGGER work_shifts_set_updated_at
  BEFORE UPDATE ON work_shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO work_shifts (name, starts_at, ends_at) VALUES
  ('manha', '07:30', '11:30'),
  ('tarde', '13:00', '17:00');

COMMENT ON TABLE species IS 'Especie botanica. Entidade central do modelo. RN-01.';
COMMENT ON TABLE species_photos IS 'Fotografia da especie, em bytes. Entra no backup do banco.';
COMMENT ON TABLE containers IS 'Recipiente. Determina o porte, o preco e o protocolo de manejo. RN-04, RN-34.';
COMMENT ON TABLE inputs IS 'Catalogo de insumos. Nada o consome no escopo atual. RN-07.';
COMMENT ON TABLE beds IS 'Canteiro. Um lote ocupa um canteiro; um canteiro comporta varios lotes. RN-19.';
COMMENT ON TABLE work_shifts IS 'Turno de trabalho. A duracao sai daqui, e nao de constante. RN-27.';
