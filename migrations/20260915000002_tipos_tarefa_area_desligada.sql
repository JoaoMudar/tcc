-- Migration: 20260915000002_tipos_tarefa_area_desligada.sql
-- Descricao: Nenhum tipo de tarefa comeca com area ligada.
--
-- Requisitos: RF-21, RF-30 · Regras: RN-25
-- Entidades: C8 `tipos_tarefa`
--
-- POR QUE ESTA MIGRATION EXISTE. A primeira versao da 20260915000001 ligava
-- `exige_area` em todo tipo sem lote fora da categoria semente, para "manter como
-- estava". Isso contraria o que o booleano decide: area e canteiro aparecem onde
-- alguem marcar, e em nenhum outro lugar. A 20260915000001 ja nao liga nada, e
-- esta aqui desfaz o que ela gravou nos bancos onde a versao antiga rodou.
--
-- IDEMPOTENTE: em banco novo, nao ha linha com `exige_area` verdadeiro, e o UPDATE
-- nao encontra nada para mudar.
--
-- SEM BEGIN/COMMIT PROPRIOS e SEM GUARDA CONDICIONAL.

UPDATE tipos_tarefa SET exige_area = false WHERE exige_area;
