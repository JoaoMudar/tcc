-- Migration: 20260901000003_cadastro_pessoas_e_tarefas.sql
-- Descricao: Identidade unica de pessoas (schema `cadastro`) e catalogo de tipos
--            de tarefa.
--
-- Requisitos: RF-14 a RF-21 · Regras: RN-15, RN-19, RN-20, RN-45 a RN-47, RN-51
-- Entidades: C8 `cadastro.pessoas`, `cadastro.pessoas_papeis`, `cadastro.pessoas_enderecos`, `tipos_tarefa`
--
-- UMA PESSOA, VARIOS PAPEIS (RN-47). Quem vende muda ao viveiro e as vezes compra
-- dele e um cadastro so. Tres tabelas de pessoa produziriam tres verdades sobre o
-- mesmo telefone.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE SCHEMA cadastro;

CREATE TYPE cadastro.tipo_pessoa AS ENUM ('pf', 'pj');
CREATE TYPE cadastro.tipo_papel AS ENUM ('cliente', 'fornecedor', 'funcionario');
CREATE TYPE cadastro.tipo_endereco AS ENUM ('entrega', 'cobranca', 'residencial');

CREATE TABLE cadastro.pessoas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          cadastro.tipo_pessoa NOT NULL,
  nome          TEXT NOT NULL,

  -- CPF ou CNPJ, apenas digitos. Nulo no cadastro rapido (RF-15, RN-46): nome e
  -- telefone bastam para registrar o pedido, e a ficha se completa depois.
  documento     TEXT UNIQUE,

  telefone      TEXT,
  email         TEXT,
  observacoes   TEXT,
  ativa         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pessoas_nome_busca ON cadastro.pessoas (nome);
CREATE INDEX pessoas_telefone_busca ON cadastro.pessoas (telefone);

CREATE TRIGGER pessoas_define_atualizado_em
  BEFORE UPDATE ON cadastro.pessoas
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- O PAPEL E QUE SE MULTIPLICA. `tipo_vinculo` so faz sentido no papel
-- `funcionario`, e fica nele em vez de poluir `pessoas` com uma coluna nula em
-- toda pessoa que so compra.
CREATE TABLE cadastro.pessoas_papeis (
  pessoa_id    UUID NOT NULL REFERENCES cadastro.pessoas(id) ON DELETE CASCADE,
  papel        cadastro.tipo_papel NOT NULL,
  tipo_vinculo TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (pessoa_id, papel),

  CONSTRAINT pessoas_papeis_vinculo_so_em_funcionario CHECK (
    tipo_vinculo IS NULL
    OR (papel = 'funcionario' AND tipo_vinculo IN ('fixo', 'diarista'))
  )
);

CREATE INDEX pessoas_papeis_por_papel ON cadastro.pessoas_papeis (papel) WHERE ativo;

-- UMA PESSOA TEM MAIS DE UM ENDERECO, e o de entrega pode nao ser o de cobranca
-- (RN-51).
CREATE TABLE cadastro.pessoas_enderecos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id     UUID NOT NULL REFERENCES cadastro.pessoas(id) ON DELETE CASCADE,
  tipo          cadastro.tipo_endereco NOT NULL,
  logradouro    TEXT,
  cidade        TEXT,
  uf            CHAR(2),
  cep           TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER pessoas_enderecos_define_atualizado_em
  BEFORE UPDATE ON cadastro.pessoas_enderecos
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

-- A credencial passa a poder apontar para a pessoa. OPCIONAL nos dois sentidos:
-- ha administrador sem vinculo, e ha funcionario sem login (seis dos nove).
ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_pessoa_fk FOREIGN KEY (pessoa_id) REFERENCES cadastro.pessoas(id);

CREATE UNIQUE INDEX usuarios_uma_credencial_por_pessoa
  ON usuarios (pessoa_id) WHERE pessoa_id IS NOT NULL;

-- ------------------------------------------------------------
-- O catalogo de tarefas comanda o formulario (RF-21, RN-15)
-- ------------------------------------------------------------
-- E o tipo de tarefa que diz se a tela vai pedir especie, recipiente, lote ou uma
-- contagem por participante. Sem isso, ou o formulario pede tudo sempre (e ninguem
-- preenche), ou pede o minimo sempre (e o dado nao serve).
CREATE TABLE tipos_tarefa (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             TEXT NOT NULL UNIQUE,
  categoria        TEXT NOT NULL,

  -- Faz a confirmacao pedir um numero POR PARTICIPANTE (RF-29, RN-24).
  e_quantitativa   BOOLEAN NOT NULL DEFAULT false,

  -- Faz aparecer o campo de lote, e dispensa o canteiro, que vem dele (RN-25).
  exige_lote       BOOLEAN NOT NULL DEFAULT false,

  -- Para as tarefas que pedem especie ou recipiente sem haver lote, como colher
  -- semente e encher saquinho.
  exige_especie    BOOLEAN NOT NULL DEFAULT false,
  exige_recipiente BOOLEAN NOT NULL DEFAULT false,

  ativo            BOOLEAN NOT NULL DEFAULT true,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- RN-23: seis categorias, e a categoria nao comanda formulario algum. Ela agrupa
  -- a lista e os relatorios.
  CONSTRAINT tipos_tarefa_categoria_valida CHECK (categoria IN
    ('semente', 'terra', 'plantio', 'manutencao', 'pos_morte', 'expedicao'))
);

CREATE TRIGGER tipos_tarefa_define_atualizado_em
  BEFORE UPDATE ON tipos_tarefa
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

INSERT INTO tipos_tarefa (nome, categoria, e_quantitativa, exige_lote, exige_especie, exige_recipiente) VALUES
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
COMMENT ON TABLE cadastro.pessoas_papeis IS
  'Papeis de uma mesma pessoa: cliente, fornecedor, funcionario. Chave composta. RN-47.';
COMMENT ON TABLE tipos_tarefa IS
  'Catalogo de tarefas. As tres declaracoes comandam o que a tela pede. RF-21, RN-15.';
