-- Migration: 20260901000001_acesso_e_configuracoes.sql
-- Descricao: Acesso (usuarios, sessoes, eventos_login) e parametros do sistema (parametros).
--
-- Requisitos: RF-01 a RF-07, RF-09 · Regras: RN-26, RN-51, RN-52
-- Entidades: C8 `usuarios`, `sessoes`, `eventos_login`, `parametros`
--
-- TRES PERFIS, E NAO QUATRO. O enum nao tem `colaborador`: os seis trabalhadores
-- de campo nao operam o sistema, e o trabalho deles e planejado e confirmado pela
-- gerencia (A1 §5). Nao confundir com `cadastro.pessoas_papeis.papel`, que tem o valor
-- `funcionario` e significa VINCULO DE TRABALHO, nao permissao.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE OR REPLACE FUNCTION define_atualizado_em() RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE perfil_usuario AS ENUM ('admin', 'chefia', 'gerencia');

CREATE TABLE usuarios (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login                   TEXT NOT NULL UNIQUE,
  nome_exibicao           TEXT NOT NULL,
  senha_hash              TEXT NOT NULL,
  perfil                  perfil_usuario NOT NULL DEFAULT 'gerencia',

  -- RF-02: o usuario recem-criado e conduzido a troca antes de qualquer tela.
  deve_trocar_senha       BOOLEAN NOT NULL DEFAULT true,

  ativo                   BOOLEAN NOT NULL DEFAULT true,
  tentativas_login_falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate           TIMESTAMPTZ,

  -- Pessoa do cadastro a que esta credencial pertence. NULO de proposito: ha
  -- administrador sem vinculo, e ha funcionario sem login (seis dos nove). A FK e
  -- acrescentada na migration do cadastro unico, quando `cadastro.pessoas` existir.
  pessoa_id               UUID,

  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX usuarios_login_idx ON usuarios (login);

CREATE TRIGGER usuarios_define_atualizado_em
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION define_atualizado_em();

CREATE TABLE sessoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- RNF-09: nunca o token em si, apenas o resumo criptografico dele.
  token_hash     TEXT NOT NULL UNIQUE,

  expira_em      TIMESTAMPTZ NOT NULL,
  ip             TEXT,
  agente_usuario TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_uso_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessoes_token_hash_idx ON sessoes (token_hash);
CREATE INDEX sessoes_usuario_idx       ON sessoes (usuario_id);

-- RF-04: toda tentativa, bem e malsucedida. `usuario_id` e nulo quando o
-- identificador digitado nao corresponde a usuario nenhum, e e justamente esse o
-- caso que interessa detectar.
CREATE TABLE eventos_login (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  login_tentado  TEXT NOT NULL,
  sucesso        BOOLEAN NOT NULL,
  ip             TEXT,
  agente_usuario TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX eventos_login_criado_idx ON eventos_login (criado_em DESC);

-- ------------------------------------------------------------
-- Parametros do sistema
-- ------------------------------------------------------------
-- NINGUEM CRIA E NINGUEM EXCLUI (RF-09, D4 §3.7). A chave nasce aqui, porque ha
-- consulta que a le pelo nome: apagar uma delas nao deixaria a tela vazia,
-- deixaria a leitura sem resposta, e o mapa passaria a considerar todo lote
-- saudavel. O que a operacao faz e alterar `valor`.
CREATE TABLE parametros (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave          TEXT NOT NULL UNIQUE,
  valor          TEXT NOT NULL,
  tipo_valor     TEXT NOT NULL,
  descricao      TEXT NOT NULL,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por UUID REFERENCES usuarios(id),

  CONSTRAINT parametros_tipo_valor_valido CHECK (tipo_valor IN ('texto', 'numero', 'booleano', 'data'))
);

-- Os limites sao PARAMETRO, nao literal (RN-26): mudam com a estacao e com a
-- tarefa. Zero em "atencao" significa que a tarefa que vence hoje ja pinta de
-- amarelo.
INSERT INTO parametros (chave, valor, tipo_valor, descricao) VALUES
  ('producao.atraso_atencao_dias', '0', 'numero',
   'Dias de atraso a partir dos quais o lote fica em atencao (RF-45, RN-26)'),
  ('producao.atraso_critico_dias', '3', 'numero',
   'Dias de atraso a partir dos quais o lote fica critico (RF-45, RN-26)'),
  ('producao.mortalidade_limite_pct', '20', 'numero',
   'Percentual de mortalidade do lote a partir do qual ele e destacado (RN-11)');

COMMENT ON TABLE usuarios IS
  'Credencial de acesso. Tres perfis: admin, chefia, gerencia. RN-51.';
COMMENT ON COLUMN usuarios.pessoa_id IS
  'Pessoa do cadastro unico. Opcional: ha login sem vinculo e vinculo sem login.';
COMMENT ON TABLE parametros IS
  'Parametro escalar do sistema. Ninguem cria e ninguem exclui: so se altera o valor. RF-09.';
