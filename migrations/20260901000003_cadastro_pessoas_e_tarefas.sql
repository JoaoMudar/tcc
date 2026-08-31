-- Migration: 20260901000003_cadastro_pessoas_e_tarefas.sql
-- Descricao: Identidade unica de pessoas (schema `cadastro`) e catalogo de tipos
--            de tarefa.
--
-- Requisitos: RF-14 a RF-21 · Regras: RN-15, RN-19, RN-20, RN-45 a RN-47, RN-51
-- Entidades: C8 `cadastro.parties`, `cadastro.party_roles`, `cadastro.addresses`, `task_types`
--
-- UMA PESSOA, VARIOS PAPEIS (RN-47). Quem vende muda ao viveiro e as vezes compra
-- dele e um cadastro so. Tres tabelas de pessoa produziriam tres verdades sobre o
-- mesmo telefone.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE SCHEMA cadastro;

CREATE TYPE cadastro.party_kind AS ENUM ('pf', 'pj');
CREATE TYPE cadastro.party_role_kind AS ENUM ('cliente', 'fornecedor', 'funcionario');
CREATE TYPE cadastro.address_kind AS ENUM ('entrega', 'cobranca', 'residencial');

CREATE TABLE cadastro.parties (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       cadastro.party_kind NOT NULL,
  name       TEXT NOT NULL,

  -- CPF ou CNPJ, apenas digitos. Nulo no cadastro rapido (RF-15, RN-46): nome e
  -- telefone bastam para registrar o pedido, e a ficha se completa depois.
  document   TEXT UNIQUE,

  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX parties_nome_busca ON cadastro.parties (name);
CREATE INDEX parties_telefone_busca ON cadastro.parties (phone);

CREATE TRIGGER parties_set_updated_at
  BEFORE UPDATE ON cadastro.parties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- O PAPEL E QUE SE MULTIPLICA. `employment_kind` so faz sentido no papel
-- `funcionario`, e fica nele em vez de poluir `parties` com uma coluna nula em
-- toda pessoa que so compra.
CREATE TABLE cadastro.party_roles (
  party_id        UUID NOT NULL REFERENCES cadastro.parties(id) ON DELETE CASCADE,
  role            cadastro.party_role_kind NOT NULL,
  employment_kind TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (party_id, role),

  CONSTRAINT party_roles_vinculo_so_em_funcionario CHECK (
    employment_kind IS NULL
    OR (role = 'funcionario' AND employment_kind IN ('fixo', 'diarista'))
  )
);

CREATE INDEX party_roles_por_papel ON cadastro.party_roles (role) WHERE active;

-- UMA PESSOA TEM MAIS DE UM ENDERECO, e o de entrega pode nao ser o de cobranca
-- (RN-51).
CREATE TABLE cadastro.addresses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id   UUID NOT NULL REFERENCES cadastro.parties(id) ON DELETE CASCADE,
  kind       cadastro.address_kind NOT NULL,
  street     TEXT,
  city       TEXT,
  state      CHAR(2),
  zip        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER addresses_set_updated_at
  BEFORE UPDATE ON cadastro.addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A credencial passa a poder apontar para a pessoa. OPCIONAL nos dois sentidos:
-- ha administrador sem vinculo, e ha funcionario sem login (seis dos nove).
ALTER TABLE users
  ADD CONSTRAINT users_party_fk FOREIGN KEY (party_id) REFERENCES cadastro.parties(id);

CREATE UNIQUE INDEX users_uma_credencial_por_pessoa
  ON users (party_id) WHERE party_id IS NOT NULL;

-- ------------------------------------------------------------
-- O catalogo de tarefas comanda o formulario (RF-21, RN-15)
-- ------------------------------------------------------------
-- E o tipo de tarefa que diz se a tela vai pedir especie, recipiente, lote ou uma
-- contagem por participante. Sem isso, ou o formulario pede tudo sempre (e ninguem
-- preenche), ou pede o minimo sempre (e o dado nao serve).
CREATE TABLE task_types (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL UNIQUE,
  category           TEXT NOT NULL,

  -- Faz a confirmacao pedir um numero POR PARTICIPANTE (RF-29, RN-24).
  is_quantitative    BOOLEAN NOT NULL DEFAULT false,

  -- Faz aparecer o campo de lote, e dispensa o canteiro, que vem dele (RN-25).
  requires_batch     BOOLEAN NOT NULL DEFAULT false,

  -- Para as tarefas que pedem especie ou recipiente sem haver lote, como colher
  -- semente e encher saquinho.
  requires_species   BOOLEAN NOT NULL DEFAULT false,
  requires_container BOOLEAN NOT NULL DEFAULT false,

  active             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- RN-23: seis categorias, e a categoria nao comanda formulario algum. Ela agrupa
  -- a lista e os relatorios.
  CONSTRAINT task_types_categoria_valida CHECK (category IN
    ('semente', 'terra', 'plantio', 'manutencao', 'pos_morte', 'expedicao'))
);

CREATE TRIGGER task_types_set_updated_at
  BEFORE UPDATE ON task_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO task_types (name, category, is_quantitative, requires_batch, requires_species, requires_container) VALUES
  ('Colher semente',        'semente',    true,  false, true,  false),
  ('Beneficiar semente',    'semente',    true,  false, true,  false),
  ('Peneirar terra',        'terra',      false, false, false, false),
  ('Encher saquinho',       'terra',      true,  false, false, true),
  ('Encher bandeja',        'terra',      true,  false, false, true),
  ('Semear',                'plantio',    true,  true,  false, false),
  ('Repicar',               'plantio',    true,  true,  false, false),
  ('Irrigar',               'manutencao', false, true,  false, false),
  ('Adubar',                'manutencao', false, true,  false, false),
  ('Capinar',               'manutencao', false, true,  false, false),
  ('Classificar',           'pos_morte',  true,  true,  false, false),
  ('Limpar canteiro',       'manutencao', false, true,  false, false),
  ('Rustificar',            'manutencao', false, true,  false, false),
  ('Separar para entrega',  'expedicao',  true,  true,  false, false),
  ('Carregar caminhao',     'expedicao',  false, false, false, false);

COMMENT ON SCHEMA cadastro IS
  'Identidade unica de pessoas. Esquema proprio porque nao pertence a nenhuma das tres areas. RN-47.';
COMMENT ON TABLE cadastro.party_roles IS
  'Papeis de uma mesma pessoa: cliente, fornecedor, funcionario. Chave composta. RN-47.';
COMMENT ON TABLE task_types IS
  'Catalogo de tarefas. As tres declaracoes comandam o que a tela pede. RF-21, RN-15.';
