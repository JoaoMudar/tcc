-- Migration: 20261008000001_especies_ffb.sql
-- Descricao: Copia local da Flora e Funga do Brasil e validacao do nome da especie.
--
-- Requisitos: RF-10, RF-68, RF-69 · Regras: RN-02, RN-66, RN-67, RN-68
-- Entidades: C8 `ref_ffb_importacao`, `ref_ffb_taxon`, `ref_ffb_distribuicao`,
--            `ref_ffb_nome_popular`, `especies`, `especies_sinonimos`,
--            `especies_nomes_populares`
--
-- POR QUE ESTA MIGRATION EXISTE. O nome cientifico era texto livre: a mesma
-- planta entrava com grafia errada, com nome antigo (sinonimo) ou com a autoria
-- grudada, e nada dizia qual era o nome aceito. A Flora e Funga do Brasil (FFB,
-- Jardim Botanico do Rio de Janeiro) e a lista oficial dos nomes de plantas do
-- pais, publicada como arquivo Darwin Core no IPT do JBRJ, licenca CC-BY 4.0.
--
-- A FFB E COPIADA, E NAO CONSULTADA. As tabelas `ref_ffb_*` sao recarregadas
-- inteiras por `scripts/ffb-importar.ts`, numa transacao so, e o aplicativo so
-- as le. Nenhuma tela depende da rede do JBRJ (RNF de disponibilidade), e a
-- versao importada fica registrada em `ref_ffb_importacao`.
--
-- O NOME E ATRIBUTO, E NAO CHAVE. Lote, pedido e protocolo apontam para
-- `especies.id`. Trocar o nome nao mexe em vinculo nenhum, e a troca e sempre
-- decisao humana: o sistema sugere, nunca renomeia sozinho (RN-67).
--
-- A VALIDACAO NAO BLOQUEIA. Nome que nao bate com a FFB entra como `pendente`
-- e espera a revisao da chefia (RN-68). Quem cadastra no celular nao ve
-- palavra tecnica.
--
-- O UNICO DO NOME CIENTIFICO PASSA A IGNORAR ACENTO, CAIXA E ESPACO. "Inga
-- vera" e "inga  vera" eram dois registros possiveis; agora nao sao. O indice
-- e parcial: a especie substituida por outra (fusao, plano seguinte ao P20) deixa o nome livre.
--
-- Compatibilidade: colunas novas com padrao; especies existentes ficam
-- `pendente` e `origem_registro = 'manual'`. As extensoes `unaccent` e
-- `pg_trgm` existem no Postgres local e no Neon.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

-- ------------------------------------------------------------
-- 1. Extensoes e normalizacao
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- IMMUTABLE para poder entrar em coluna gerada e indice. `unaccent(text)` de
-- um argumento e STABLE porque depende do search_path; com o dicionario
-- qualificado, o resultado so depende da entrada.
CREATE FUNCTION normaliza_nome(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(lower(public.unaccent('public.unaccent'::regdictionary, coalesce(t, ''))), '\s+', ' ', 'g'))
$$;

COMMENT ON FUNCTION normaliza_nome(TEXT) IS
  'Minusculo, sem acento, espacos colapsados. Espelho em TS: normalizaNomeCientifico (src/lib/ffb/nomes.ts).';

-- ------------------------------------------------------------
-- 2. Copia da FFB (somente leitura no aplicativo)
-- ------------------------------------------------------------
CREATE TABLE ref_ffb_importacao (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_ipt   TEXT NOT NULL,
  publicada_em DATE,
  importada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fonte        TEXT NOT NULL CHECK (fonte IN ('ipt', 'gbif')),
  total_taxons INTEGER NOT NULL CHECK (total_taxons >= 0)
);

-- So Plantae, so nivel de especie para baixo (especie, subespecie, variedade,
-- forma), com sinonimos: sao eles que resolvem o nome antigo.
CREATE TABLE ref_ffb_taxon (
  taxon_id             TEXT PRIMARY KEY,
  nome_cientifico      TEXT NOT NULL,
  nome_canonico        TEXT NOT NULL,
  autoria              TEXT,
  categoria_taxonomica TEXT NOT NULL CHECK (categoria_taxonomica IN ('ESPECIE', 'SUB_ESPECIE', 'VARIEDADE', 'FORMA')),
  situacao             TEXT NOT NULL CHECK (situacao IN ('NOME_ACEITO', 'SINONIMO', 'SEM_SITUACAO')),
  -- Para sinonimo: o taxon aceito, ja seguido ate o fim da cadeia na importacao
  aceito_taxon_id      TEXT,
  familia              TEXT,
  genero               TEXT,
  -- Derivados da distribuicao na importacao: nativa se nativa em alguma UF
  origem               TEXT CHECK (origem IN ('nativa', 'exotica')),
  nativa_sc            BOOLEAN NOT NULL DEFAULT false,
  nome_normalizado     TEXT GENERATED ALWAYS AS (normaliza_nome(nome_canonico)) STORED
);

CREATE INDEX ref_ffb_taxon_nome ON ref_ffb_taxon (nome_normalizado);
CREATE INDEX ref_ffb_taxon_nome_trgm ON ref_ffb_taxon USING gin (nome_normalizado gin_trgm_ops);
CREATE INDEX ref_ffb_taxon_aceito ON ref_ffb_taxon (aceito_taxon_id) WHERE aceito_taxon_id IS NOT NULL;

CREATE TABLE ref_ffb_distribuicao (
  taxon_id        TEXT NOT NULL REFERENCES ref_ffb_taxon ON DELETE CASCADE,
  uf              CHAR(2) NOT NULL,
  estabelecimento TEXT CHECK (estabelecimento IN ('nativa', 'exotica')),
  endemica        BOOLEAN,
  dominios        TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (taxon_id, uf)
);

CREATE TABLE ref_ffb_nome_popular (
  taxon_id         TEXT NOT NULL REFERENCES ref_ffb_taxon ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  nome_normalizado TEXT GENERATED ALWAYS AS (normaliza_nome(nome)) STORED,
  PRIMARY KEY (taxon_id, nome)
);

CREATE INDEX ref_ffb_nome_popular_trgm ON ref_ffb_nome_popular USING gin (nome_normalizado gin_trgm_ops);

COMMENT ON TABLE ref_ffb_taxon IS
  'Copia da Flora e Funga do Brasil (JBRJ, CC-BY 4.0). Recarregada inteira por scripts/ffb-importar.ts.';

-- ------------------------------------------------------------
-- 3. A especie ganha o vinculo com a FFB
-- ------------------------------------------------------------
ALTER TABLE especies
  ADD COLUMN taxon_id_ffb         TEXT,
  ADD COLUMN autoria              TEXT,
  ADD COLUMN familia              TEXT,
  ADD COLUMN categoria_taxonomica TEXT NOT NULL DEFAULT 'ESPECIE'
    CHECK (categoria_taxonomica IN ('ESPECIE', 'SUB_ESPECIE', 'VARIEDADE', 'FORMA')),
  ADD COLUMN origem               TEXT CHECK (origem IN ('nativa', 'exotica')),
  ADD COLUMN nativa_sc            BOOLEAN,
  ADD COLUMN origem_registro      TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem_registro IN ('manual', 'legado_csv', 'ffb')),
  ADD COLUMN id_legado            INTEGER,
  ADD COLUMN status_validacao     TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_validacao IN ('validado', 'pendente', 'a_identificar', 'fora_da_ffb')),
  ADD COLUMN validado_em          TIMESTAMPTZ,
  ADD COLUMN validado_versao_ipt  TEXT,
  ADD COLUMN substituida_por_id   UUID REFERENCES especies(id),
  ADD COLUMN nome_normalizado     TEXT GENERATED ALWAYS AS (normaliza_nome(nome_cientifico)) STORED,
  ADD CONSTRAINT especies_validada_tem_taxon CHECK (status_validacao <> 'validado' OR taxon_id_ffb IS NOT NULL),
  ADD CONSTRAINT especies_nao_substitui_a_si CHECK (substituida_por_id IS DISTINCT FROM id);

-- O taxon_id fica sem FK: a referencia e recarregada, e um taxon que some da
-- FFB vira item de revisao, e nao erro de integridade.
ALTER TABLE especies DROP CONSTRAINT especies_nome_cientifico_key;
CREATE UNIQUE INDEX especies_nome_normalizado_unico ON especies (nome_normalizado) WHERE substituida_por_id IS NULL;
-- Dois sinonimos nao viram duas especies
CREATE UNIQUE INDEX especies_taxon_ffb_unico ON especies (taxon_id_ffb)
  WHERE taxon_id_ffb IS NOT NULL AND substituida_por_id IS NULL;
CREATE UNIQUE INDEX especies_id_legado_unico ON especies (id_legado) WHERE id_legado IS NOT NULL;
CREATE INDEX especies_nome_trgm ON especies USING gin (nome_normalizado gin_trgm_ops);

COMMENT ON COLUMN especies.nome_cientifico IS 'Nome canonico, sem autoria. A autoria fica em `autoria`.';
COMMENT ON COLUMN especies.status_validacao IS
  'validado: bate com nome aceito da FFB. pendente: espera revisao. a_identificar: rotulo provisorio ("Myrcia sp. 1"). fora_da_ffb: planta que a FFB nao cobre.';

-- ------------------------------------------------------------
-- 4. Sinonimos: os outros nomes cientificos da mesma especie
-- ------------------------------------------------------------
CREATE TABLE especies_sinonimos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  especie_id       UUID NOT NULL REFERENCES especies(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  autoria          TEXT,
  taxon_id_ffb     TEXT,
  fonte            TEXT NOT NULL CHECK (fonte IN ('ffb', 'legado_csv', 'manual')),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nome_normalizado TEXT GENERATED ALWAYS AS (normaliza_nome(nome)) STORED,

  CONSTRAINT especies_sinonimos_nome_unico UNIQUE (nome_normalizado)
);

CREATE INDEX especies_sinonimos_especie ON especies_sinonimos (especie_id);

-- Um nome nao pode ser o nome de uma especie e o sinonimo de outra. Os dois
-- lados sao vigiados: gravar o sinonimo e renomear a especie.
CREATE FUNCTION especies_confere_nome_e_sinonimo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'especies_sinonimos' THEN
    IF EXISTS (SELECT 1 FROM especies e
                WHERE e.nome_normalizado = NEW.nome_normalizado
                  AND e.id <> NEW.especie_id
                  AND e.substituida_por_id IS NULL) THEN
      RAISE EXCEPTION 'O nome % ja e de outra especie.', NEW.nome
        USING ERRCODE = '23505', CONSTRAINT = 'especies_nome_e_sinonimo';
    END IF;
  ELSIF NEW.substituida_por_id IS NULL AND EXISTS (
          SELECT 1 FROM especies_sinonimos s
           WHERE s.nome_normalizado = NEW.nome_normalizado AND s.especie_id <> NEW.id) THEN
    RAISE EXCEPTION 'O nome % ja e sinonimo de outra especie.', NEW.nome_cientifico
      USING ERRCODE = '23505', CONSTRAINT = 'especies_nome_e_sinonimo';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER especies_sinonimos_confere_nome
  AFTER INSERT OR UPDATE OF nome, especie_id ON especies_sinonimos
  FOR EACH ROW EXECUTE FUNCTION especies_confere_nome_e_sinonimo();

CREATE TRIGGER especies_confere_nome
  AFTER INSERT OR UPDATE OF nome_cientifico, substituida_por_id ON especies
  FOR EACH ROW EXECUTE FUNCTION especies_confere_nome_e_sinonimo();

-- ------------------------------------------------------------
-- 5. De onde veio o nome popular
-- ------------------------------------------------------------
ALTER TABLE especies_nomes_populares
  ADD COLUMN fonte TEXT NOT NULL DEFAULT 'viveiro' CHECK (fonte IN ('viveiro', 'ffb'));

CREATE INDEX especies_nomes_populares_trgm
  ON especies_nomes_populares USING gin (normaliza_nome(nome) gin_trgm_ops);
