# De-para: inglês para português

Registro da renomeação do modelo de dados. Até esta alteração o banco nomeava tabelas e colunas em
inglês, e a pasta [`modelo-dados-pt`](README.md) guardava a tradução manual usada nas figuras do
TCC. As duas línguas deixaram de existir: **o banco passou a ser o que as figuras já eram**, e o
vocabulário do esquema é agora o mesmo do glossário.

Esta tabela existe por um motivo prático: **o aplicativo vive em outro repositório** e continua
apontando para os nomes antigos. É daqui que sai o que ele precisa renomear.

> Identificador do banco não leva acento nem cedilha (`observacoes`, `codigo`, `situacao`), como as
> figuras já escreviam. A prosa e as descrições continuam acentuadas.

## Entidades

| Antes | Depois |
|---|---|
| `addresses` | `pessoas_enderecos` |
| `assignment_members` | `atribuicoes_participantes` |
| `assignments` | `atribuicoes` |
| `batch_health` | `situacao_lote` |
| `batch_movements` | `movimentos_lote` |
| `batch_protocol_due` | `lotes_etapas_vencimento` |
| `batch_protocol_steps` | `lotes_etapas` |
| `batches` | `lotes` |
| `beds` | `canteiros` |
| `containers` | `recipientes` |
| `inputs` | `insumos` |
| `login_events` | `eventos_login` |
| `order_items` | `pedidos_itens` |
| `orders` | `pedidos` |
| `parties` | `pessoas` |
| `party_roles` | `pessoas_papeis` |
| `protocol_steps` | `protocolos_etapas` |
| `protocols` | `protocolos` |
| `sessions` | `sessoes` |
| `settings` | `parametros` |
| `species` | `especies` |
| `species_photos` | `especies_fotos` |
| `species_popular_names` | `especies_nomes_populares` |
| `species_protocol_overrides` | `especies_protocolos_tempos` |
| `task_types` | `tipos_tarefa` |
| `users` | `usuarios` |
| `week_plans` | `semanas` |
| `work_shifts` | `turnos_trabalho` |

O esquema `cadastro` já era português e não mudou: `cadastro.parties` virou `cadastro.pessoas`. A
tabela de controle `_migrations` também fica como está.

## Tipos enumerados

| Antes | Depois |
|---|---|
| `address_kind` | `tipo_endereco` |
| `input_category` | `categoria_insumo` |
| `party_kind` | `tipo_pessoa` |
| `party_role_kind` | `tipo_papel` |
| `user_role` | `perfil_usuario` |

**Os valores dos enums não mudaram**: já eram português (`pf`, `pj`, `cliente`, `fornecedor`,
`funcionario`, `substrato`, `adubo`, `admin`, `chefia`, `gerencia`).

## Colunas

| Antes | Depois |
|---|---|
| `active` | `ativo` |
| `alert_enabled` | `alerta_ligado` |
| `anchor_date` | `data_ancora` |
| `anchor_step_id` | `etapa_ancora_id` |
| `anchor_type` | `tipo_ancora` |
| `assignment_id` | `atribuicao_id` |
| `avg_minutes_per_unit` | `minutos_medios_por_unidade` |
| `batch_code` | `codigo_lote` |
| `batch_id` | `lote_id` |
| `batch_protocol_step_id` | `lote_etapa_id` |
| `bed_id` | `canteiro_id` |
| `capacity` | `capacidade` |
| `category` | `categoria` |
| `city` | `cidade` |
| `closed_reason` | `motivo_encerramento` |
| `code` | `codigo` |
| `common_name` | `nome_popular` |
| `completed_at` | `concluido_em` |
| `container_id` | `recipiente_id` |
| `container_types` | `tipos_recipiente` |
| `content` | `conteudo` |
| `content_type` | `tipo_conteudo` |
| `created_at` | `criado_em` |
| `created_by` | `criado_por` |
| `current_quantity` | `quantidade_atual` |
| `customer_id` | `cliente_id` |
| `customers` | `clientes` |
| `days` | `dias` |
| `days_late` | `dias_atraso` |
| `delivery_date` | `data_entrega` |
| `description` | `descricao` |
| `display_name` | `nome_exibicao` |
| `document` | `documento` |
| `due_at` | `vence_em` |
| `due_on` | `vence_em` |
| `effective_days` | `dias_efetivos` |
| `employment_kind` | `tipo_vinculo` |
| `end_time` | `hora_fim` |
| `ends_at` | `fim` |
| `expires_at` | `expira_em` |
| `failed_login_attempts` | `tentativas_login_falhas` |
| `from_bed_id` | `canteiro_origem_id` |
| `germination_time_days` | `dias_germinacao` |
| `growth_time_months` | `meses_crescimento` |
| `health` | `situacao` |
| `inherited_from_batch_id` | `herdado_do_lote_id` |
| `initial_quantity` | `quantidade_inicial` |
| `interval_days` | `intervalo_dias` |
| `is_primary` | `e_principal` |
| `is_quantitative` | `e_quantitativa` |
| `is_recurring` | `e_recorrente` |
| `key` | `chave` |
| `kind` | `tipo` |
| `label` | `rotulo` |
| `last_done_on` | `ultima_execucao_em` |
| `last_seen_at` | `ultimo_uso_em` |
| `letter` | `letra` |
| `locked_until` | `bloqueado_ate` |
| `loss_cause` | `causa_perda` |
| `loss_events` | `eventos_perda` |
| `measurement_type` | `tipo_medicao` |
| `movement_date` | `data_movimento` |
| `movement_type` | `tipo_movimento` |
| `must_change_password` | `deve_trocar_senha` |
| `name` | `nome` |
| `next_due_on` | `proximo_vencimento` |
| `notes` | `observacoes` |
| `number` | `numero` |
| `occurrence` | `ocorrencia` |
| `occurrences` | `ocorrencias` |
| `offset_days` | `dias` |
| `order_id` | `pedido_id` |
| `order_number` | `numero_pedido` |
| `parent_batch_id` | `lote_origem_id` |
| `party_id` | `pessoa_id` |
| `password_hash` | `senha_hash` |
| `pending_assignment_id` | `atribuicao_pendente_id` |
| `pending_since` | `pendente_desde` |
| `pending_task_name` | `tarefa_pendente` |
| `pending_task_type_id` | `tipo_tarefa_pendente_id` |
| `phone` | `telefone` |
| `photo_url` | `foto_url` |
| `planned_quantity` | `quantidade_planejada` |
| `planted_at` | `data_plantio` |
| `position` | `posicao` |
| `protocol_due_on` | `vencimento_protocolo` |
| `protocol_id` | `protocolo_id` |
| `protocol_step_id` | `protocolo_etapa_id` |
| `published_by` | `publicada_por` |
| `quantity` | `quantidade` |
| `quantity_done` | `quantidade_feita` |
| `recorded_by` | `registrado_por` |
| `requires_batch` | `exige_lote` |
| `requires_container` | `exige_recipiente` |
| `requires_species` | `exige_especie` |
| `resulting_stage` | `fase_resultante` |
| `sale_channel` | `canal_venda` |
| `schedule_kind` | `tipo_agendamento` |
| `schedule_type` | `tipo_agendamento` |
| `scientific_name` | `nome_cientifico` |
| `shift` | `turno` |
| `shift_id` | `turno_id` |
| `sort_order` | `posicao` |
| `species_id` | `especie_id` |
| `stage` | `fase` |
| `start_time` | `hora_inicio` |
| `started_at` | `iniciado_em` |
| `starts_at` | `inicio` |
| `state` | `uf` |
| `status` | `situacao` |
| `step_id` | `protocolo_etapa_id` |
| `street` | `logradouro` |
| `success` | `sucesso` |
| `tags` | `caracteristicas` |
| `task_name` | `nome_tarefa` |
| `task_type_id` | `tipo_tarefa_id` |
| `to_bed_id` | `canteiro_destino_id` |
| `unit_of_measure` | `unidade_medida` |
| `unit_price` | `preco_unitario` |
| `updated_at` | `atualizado_em` |
| `updated_by` | `atualizado_por` |
| `user_agent` | `agente_usuario` |
| `user_id` | `usuario_id` |
| `username` | `login` |
| `username_attempted` | `login_tentado` |
| `value` | `valor` |
| `value_type` | `tipo_valor` |
| `volume_liters` | `volume_litros` |
| `warn_window_pct` | `janela_aviso_pct` |
| `warning_days` | `dias_aviso` |
| `warning_pct` | `janela_aviso_pct` |
| `warning_window_pct` | `janela_aviso_pct` |
| `week_plan_id` | `semana_id` |
| `week_start` | `inicio_semana` |
| `work_date` | `data_trabalho` |
| `zip` | `cep` |

**Três colunas mudam de destino conforme a tabela**, e são as únicas:

| Coluna | Em | Vira |
|---|---|---|
| `role` | `usuarios` | `perfil` |
| `role` | `cadastro.pessoas_papeis` | `papel` |
| `closed_at` | `lotes` | `encerrado_em` |
| `closed_at` | `semanas` | `fechada_em` |
| `active` | `especies`, `cadastro.pessoas` | `ativa` |
| `active` | todas as demais | `ativo` |

`ativa` acompanha o gênero do nome da entidade, e é o que as figuras `fig09` e `fig12` já
desenhavam.

## Índices, restrições, gatilhos e função

| Antes | Depois |
|---|---|
| `addresses_set_updated_at` | `pessoas_enderecos_define_atualizado_em` |
| `areas_set_updated_at` | `areas_define_atualizado_em` |
| `assignment_members_pessoa_idx` | `atribuicoes_participantes_pessoa_idx` |
| `assignment_members_quantidade_nao_negativa` | `atribuicoes_participantes_quantidade_nao_negativa` |
| `assignments_hora_coerente` | `atribuicoes_hora_coerente` |
| `assignments_lote_idx` | `atribuicoes_lote_idx` |
| `assignments_pendentes_idx` | `atribuicoes_pendentes_idx` |
| `assignments_quantidade_positiva` | `atribuicoes_quantidade_positiva` |
| `assignments_semana_idx` | `atribuicoes_semana_idx` |
| `assignments_set_updated_at` | `atribuicoes_define_atualizado_em` |
| `assignments_status_valido` | `atribuicoes_situacao_valida` |
| `batch_movements_assignment_fk` | `movimentos_lote_atribuicao_fk` |
| `batch_movements_batch_idx` | `movimentos_lote_lote_idx` |
| `batch_movements_causa_so_em_perda` | `movimentos_lote_causa_so_em_perda` |
| `batch_movements_perdas_idx` | `movimentos_lote_perdas_idx` |
| `batch_movements_transferencia_coerente` | `movimentos_lote_transferencia_coerente` |
| `batch_movements_type_valido` | `movimentos_lote_tipo_valido` |
| `batches_abertos_idx` | `lotes_abertos_idx` |
| `batches_encerrado_sem_canteiro` | `lotes_encerrado_sem_canteiro` |
| `batches_initial_positivo` | `lotes_inicial_positivo` |
| `batches_motivo_com_encerramento` | `lotes_motivo_com_encerramento` |
| `batches_origem_nao_e_ele_mesmo` | `lotes_origem_nao_e_ele_mesmo` |
| `batches_parent_idx` | `lotes_origem_idx` |
| `batches_posicao_unica_no_canteiro` | `lotes_posicao_unica_no_canteiro` |
| `batches_prontos_idx` | `lotes_prontos_idx` |
| `batches_saldo_nao_negativo` | `lotes_saldo_nao_negativo` |
| `batches_set_updated_at` | `lotes_define_atualizado_em` |
| `batches_species_idx` | `lotes_especie_idx` |
| `batches_stage_valido` | `lotes_fase_valida` |
| `batches_um_lote_aberto_por_canteiro` | `lotes_um_lote_aberto_por_canteiro` |
| `beds_numero_positivo` | `canteiros_numero_positivo` |
| `beds_numero_unico_na_area` | `canteiros_numero_unico_na_area` |
| `beds_set_updated_at` | `canteiros_define_atualizado_em` |
| `containers_set_updated_at` | `recipientes_define_atualizado_em` |
| `inputs_set_updated_at` | `insumos_define_atualizado_em` |
| `login_events_created_idx` | `eventos_login_criado_idx` |
| `order_items_order_idx` | `pedidos_itens_pedido_idx` |
| `order_items_preco_positivo` | `pedidos_itens_preco_positivo` |
| `order_items_quantidade_positiva` | `pedidos_itens_quantidade_positiva` |
| `order_items_set_updated_at` | `pedidos_itens_define_atualizado_em` |
| `orders_canal_idx` | `pedidos_canal_idx` |
| `orders_canal_valido` | `pedidos_canal_valido` |
| `orders_cliente_idx` | `pedidos_cliente_idx` |
| `orders_periodo_idx` | `pedidos_periodo_idx` |
| `orders_set_updated_at` | `pedidos_define_atualizado_em` |
| `orders_status_valido` | `pedidos_situacao_valida` |
| `parties_nome_busca` | `pessoas_nome_busca` |
| `parties_set_updated_at` | `pessoas_define_atualizado_em` |
| `parties_telefone_busca` | `pessoas_telefone_busca` |
| `party_roles_por_papel` | `pessoas_papeis_por_papel` |
| `party_roles_vinculo_so_em_funcionario` | `pessoas_papeis_vinculo_so_em_funcionario` |
| `sessions_token_hash_idx` | `sessoes_token_hash_idx` |
| `sessions_user_idx` | `sessoes_usuario_idx` |
| `set_updated_at` | `define_atualizado_em` |
| `settings_value_type_valido` | `parametros_tipo_valor_valido` |
| `species_popular_names_busca` | `especies_nomes_populares_busca` |
| `species_popular_names_unico` | `especies_nomes_populares_unico` |
| `species_set_updated_at` | `especies_define_atualizado_em` |
| `species_um_nome_primario` | `especies_um_nome_primario` |
| `task_types_categoria_valida` | `tipos_tarefa_categoria_valida` |
| `task_types_set_updated_at` | `tipos_tarefa_define_atualizado_em` |
| `users_party_fk` | `usuarios_pessoa_fk` |
| `users_set_updated_at` | `usuarios_define_atualizado_em` |
| `users_uma_credencial_por_pessoa` | `usuarios_uma_credencial_por_pessoa` |
| `users_username_idx` | `usuarios_login_idx` |
| `week_plans_fechamento_coerente` | `semanas_fechamento_coerente` |
| `week_plans_set_updated_at` | `semanas_define_atualizado_em` |
| `week_plans_status_valido` | `semanas_situacao_valida` |
| `work_shifts_intervalo_valido` | `turnos_trabalho_intervalo_valido` |
| `work_shifts_set_updated_at` | `turnos_trabalho_define_atualizado_em` |

`areas_letra_maiuscula` já estava em português e não mudou.

## Colunas que mudaram de sentido, e não só de idioma

- `batches.parent_batch_id` virou `lotes.lote_origem_id`. "Pai" descreve a estrutura da árvore;
  "origem" descreve o que o viveiro faz, que é dizer de onde aquela leva veio.
- `batch_movements.from_bed_id` / `to_bed_id` viraram `canteiro_origem_id` / `canteiro_destino_id`:
  preposição em inglês vira substantivo em português.
- `status` virou `situacao` em todo o modelo, em `atribuicoes`, `semanas` e `pedidos`.
- `settings` virou `parametros`, e não `configuracoes`. A tela chama-se Configurações do sistema; a
  tabela guarda os parâmetros que ela ajusta, e nomear as duas igual confundiria o que é tela com o
  que é dado.
- `species.tags` virou `especies.caracteristicas`: "tag" não tem tradução que o usuário do viveiro
  reconheça, e o que a coluna guarda é o que a espécie é (frutífera, madeireira).
- `users.username` virou `usuarios.login`, e não `nome_usuario`: é como as três pessoas que operam
  o sistema chamam o campo.
- `set_updated_at` virou `define_atualizado_em`, e os gatilhos que a chamam seguiram o nome.
