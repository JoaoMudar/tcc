// Telas do capítulo 5 (docs/revisao-cap-5-resultados.md §5), uma entrada por figura.
//
// Campos de cada tela:
//   id      nome do arquivo de saída, sem extensão (a numeração da figura fica no Word)
//   url     rota; `:id` é trocado pelo resultado da `sql`
//   sql     consulta que devolve uma linha com a coluna `id` (rotas com [id] ou [data])
//   perfil  chefia | gerencia | admin; null = sem login
//   banco   espelho (cópia do Neon: dado real, mais a produção fictícia quando carregada) | dev
//   esperar seletor que precisa estar visível antes do print (opcional)
//   offline true desliga a rede depois de carregar, para mostrar o aviso sem conexão
//
// O script só roda as telas do banco para o qual a DATABASE_URL aponta.

/** Nome do banco no Postgres local para cada origem. */
export const BANCOS = { espelho: 'viveiro_espelho', dev: 'tcc' };

export const TELAS = [
  // 5.1 Acesso e configurações
  { id: '5-1-entrada', url: '/login', perfil: null, banco: 'espelho' },
  { id: '5-1-inicio-chefia', url: '/', perfil: 'chefia', banco: 'espelho' },
  { id: '5-1-inicio-gerencia', url: '/', perfil: 'gerencia', banco: 'espelho' },
  { id: '5-1-inicio-admin', url: '/', perfil: 'admin', banco: 'espelho' },
  { id: '5-1-parametros', url: '/configuracoes/parametros', perfil: 'chefia', banco: 'espelho' },

  // 5.2 Cadastro único
  { id: '5-2-cadastros', url: '/cadastros', perfil: 'chefia', banco: 'espelho' },
  { id: '5-2-especies', url: '/cadastros/especies', perfil: 'chefia', banco: 'espelho' },
  {
    id: '5-2-especie-ficha',
    url: '/cadastros/especies/:id',
    sql: `SELECT id FROM especies ORDER BY (foto_url IS NOT NULL) DESC, nome_cientifico LIMIT 1`,
    perfil: 'chefia',
    banco: 'espelho',
  },
  { id: '5-2-pessoas', url: '/cadastros/pessoas', perfil: 'chefia', banco: 'espelho' },
  { id: '5-2-recipientes', url: '/cadastros/recipientes', perfil: 'chefia', banco: 'espelho' },
  { id: '5-2-areas-canteiros', url: '/cadastros/areas', perfil: 'gerencia', banco: 'espelho' },

  // 5.3 Produção: dados fictícios da `scripts/carga-ficticia.ts` no espelho, que não tem produção real
  { id: '5-3-mapa-producao', url: '/producao?aba=mapa', perfil: 'gerencia', banco: 'espelho' },
  { id: '5-3-lotes', url: '/producao/lotes', perfil: 'gerencia', banco: 'espelho' },
  {
    id: '5-3-lote-ficha',
    url: '/producao/lotes/:id',
    sql: `SELECT l.id FROM lotes l JOIN movimentos_lote m ON m.lote_id = l.id
          GROUP BY l.id ORDER BY COUNT(*) DESC LIMIT 1`,
    perfil: 'gerencia',
    banco: 'espelho',
  },
  { id: '5-3-perdas', url: '/producao/perdas', perfil: 'gerencia', banco: 'espelho' },
  { id: '5-3-saldo', url: '/producao/saldo', perfil: 'gerencia', banco: 'espelho' },
  { id: '5-3-agenda', url: '/producao', perfil: 'gerencia', banco: 'espelho' },
  { id: '5-3-agenda-sem-conexao', url: '/producao', perfil: 'gerencia', banco: 'espelho', offline: true },

  // 5.4 Comercial (dado real, cliente e preço borrados)
  { id: '5-4-carteira', url: '/pedidos', perfil: 'chefia', banco: 'espelho' },
  { id: '5-4-novo-pedido', url: '/pedidos/novo', perfil: 'chefia', banco: 'espelho' },
  {
    id: '5-4-pedido-ficha',
    url: '/pedidos/:id',
    sql: `SELECT id FROM pedidos WHERE situacao IN ('pronto_envio', 'carregado', 'concluido') ORDER BY criado_em DESC LIMIT 1`,
    perfil: 'chefia',
    banco: 'espelho',
  },
  {
    id: '5-4-verificar',
    url: '/pedidos/:id/verificar',
    sql: `SELECT id FROM pedidos WHERE situacao = 'verificando' ORDER BY criado_em DESC LIMIT 1`,
    perfil: 'chefia',
    banco: 'espelho',
  },
  {
    // O espelho não tem pedido real em separação; este é o fictício da `carga-ficticia.ts`
    id: '5-4-separar',
    url: '/pedidos/:id/separar',
    sql: `SELECT id FROM pedidos WHERE situacao = 'separando' ORDER BY criado_em DESC LIMIT 1`,
    perfil: 'gerencia',
    banco: 'espelho',
  },
  {
    id: '5-4-planejar-viagem',
    url: '/pedidos/planejar/:id',
    sql: `SELECT data_entrega::text AS id FROM pedidos
          WHERE situacao IN ('pronto_envio', 'carregado', 'concluido') AND data_entrega IS NOT NULL
          ORDER BY data_entrega DESC LIMIT 1`,
    perfil: 'chefia',
    banco: 'espelho',
  },
];
