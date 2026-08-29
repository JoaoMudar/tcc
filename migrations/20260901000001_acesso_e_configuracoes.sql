-- Migration: 20260901000001_acesso_e_configuracoes.sql
-- Descricao: Acesso (users, sessions, login_events) e parametros do sistema (settings).
--
-- Requisitos: RF-01 a RF-07, RF-09 · Regras: RN-32, RN-59, RN-60
-- Entidades: C8 `users`, `sessions`, `login_events`, `settings`
--
-- TRES PERFIS, E NAO QUATRO. O enum nao tem `colaborador`: os seis trabalhadores
-- de campo nao operam o sistema, e o trabalho deles e planejado e confirmado pela
-- gerencia (A1 §5). Nao confundir com `cadastro.party_roles.role`, que tem o valor
-- `funcionario` e significa VINCULO DE TRABALHO, nao permissao.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE user_role AS ENUM ('admin', 'chefia', 'gerencia');

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username              TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  role                  user_role NOT NULL DEFAULT 'gerencia',

  -- RF-02: o usuario recem-criado e conduzido a troca antes de qualquer tela.
  must_change_password  BOOLEAN NOT NULL DEFAULT true,

  active                BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,

  -- Pessoa do cadastro a que esta credencial pertence. NULO de proposito: ha
  -- administrador sem vinculo, e ha funcionario sem login (seis dos nove). A FK e
  -- acrescentada na migration do cadastro unico, quando `cadastro.parties` existir.
  party_id              UUID,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_username_idx ON users (username);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- RNF-10: nunca o token em si, apenas o resumo criptografico dele.
  token_hash   TEXT NOT NULL UNIQUE,

  expires_at   TIMESTAMPTZ NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_token_hash_idx ON sessions (token_hash);
CREATE INDEX sessions_user_idx       ON sessions (user_id);

-- RF-04: toda tentativa, bem e malsucedida. `user_id` e nulo quando o
-- identificador digitado nao corresponde a usuario nenhum, e e justamente esse o
-- caso que interessa detectar.
CREATE TABLE login_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  username_attempted TEXT NOT NULL,
  success            BOOLEAN NOT NULL,
  ip                 TEXT,
  user_agent         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX login_events_created_idx ON login_events (created_at DESC);

-- ------------------------------------------------------------
-- Parametros do sistema
-- ------------------------------------------------------------
-- NINGUEM CRIA E NINGUEM EXCLUI (RF-09, D4 §3.7). A chave nasce aqui, porque ha
-- consulta que a le pelo nome: apagar uma delas nao deixaria a tela vazia,
-- deixaria a leitura sem resposta, e o mapa passaria a considerar todo lote
-- saudavel. O que a operacao faz e alterar `value`.
CREATE TABLE settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  value_type  TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id),

  CONSTRAINT settings_value_type_valido CHECK (value_type IN ('texto', 'numero', 'booleano', 'data'))
);

-- Os limites sao PARAMETRO, nao literal (RN-32): mudam com a estacao e com a
-- tarefa. Zero em "atencao" significa que a tarefa que vence hoje ja pinta de
-- amarelo.
INSERT INTO settings (key, value, value_type, description) VALUES
  ('producao.atraso_atencao_dias', '0', 'numero',
   'Dias de atraso a partir dos quais o lote fica em atencao (RN-31, RN-32)'),
  ('producao.atraso_critico_dias', '3', 'numero',
   'Dias de atraso a partir dos quais o lote fica critico (RN-31, RN-32)'),
  ('producao.mortalidade_limite_pct', '20', 'numero',
   'Percentual de mortalidade do lote a partir do qual ele e destacado (RN-11)');

COMMENT ON TABLE users IS
  'Credencial de acesso. Tres perfis: admin, chefia, gerencia. RN-59.';
COMMENT ON COLUMN users.party_id IS
  'Pessoa do cadastro unico. Opcional: ha login sem vinculo e vinculo sem login.';
COMMENT ON TABLE settings IS
  'Parametro escalar do sistema. Ninguem cria e ninguem exclui: so se altera o valor. RF-09.';
