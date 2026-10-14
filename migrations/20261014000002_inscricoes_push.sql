-- Inscricoes de notificacao (Web Push) de cada aparelho
--
-- Entidades: C8 `inscricoes_push`
--
-- POR QUE ESTA MIGRATION EXISTE. O pedido passa de mao em mao (chefia cadastra,
-- gerencia confere, chefia aprova, gerencia separa), e quem recebe a vez so
-- sabia dela abrindo o sistema. O aviso no celular chega pelo servico de push
-- do navegador, e o servidor precisa guardar o endereco que o navegador deu a
-- cada aparelho para mandar o aviso ate la.
--
-- UMA LINHA POR APARELHO, E NAO POR USUARIO. Quem usa celular e computador
-- recebe nos dois. O `endpoint` e unico: o navegador que se inscreve de novo
-- devolve o mesmo endereco, e a linha troca de dono se outra pessoa entrar no
-- mesmo aparelho.
--
-- `p256dh` e `auth` sao as chaves publicas do aparelho, com que o servidor
-- cifra a mensagem; nao sao segredo do usuario. A linha morre com o usuario
-- (CASCADE), e o envio apaga a que o servico de push disser que expirou.
--
-- Compatibilidade: tabela nova; nada do que existe muda.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

CREATE TABLE inscricoes_push (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inscricoes_push_usuario_idx ON inscricoes_push (usuario_id);

COMMENT ON TABLE inscricoes_push IS
  'Aparelho inscrito para receber aviso no celular (Web Push). Uma linha por aparelho; o endpoint e unico.';
COMMENT ON COLUMN inscricoes_push.endpoint IS
  'Endereco que o servico de push do navegador deu ao aparelho. Expira: o envio apaga a linha quando o servico responde 404 ou 410.';
