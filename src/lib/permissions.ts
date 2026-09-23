/**
 * Matriz de acesso do D4 §2 como dado: a única fonte das permissões no código.
 * Letras: C criar, L ler, A atualizar, E excluir. O teste
 * `__tests__/permissions.test.ts` confere cada célula contra o documento.
 *
 * Sem 'server-only' para ser testável, mas NUNCA importar em Client Component:
 * regra de acesso não vai para o navegador (RNF-11, TA-60).
 */

import type { Perfil } from './perfis';

export type { Perfil };
export type Operacao = 'C' | 'L' | 'A' | 'E';

interface Regra {
  label: string;
  chefia: string;
  gerencia: string;
  admin: string;
}

export const ACCESS_MATRIX = {
  // Acesso
  usuarios: { label: 'Usuários e perfis', chefia: '', gerencia: '', admin: 'CLAE' },
  sessoes_proprias: { label: 'Sessões próprias', chefia: 'LE', gerencia: 'LE', admin: 'LE' },
  auditoria_acesso: { label: 'Auditoria de acesso', chefia: '', gerencia: '', admin: 'L' },
  // Configurações
  periodo_trabalho: { label: 'Período de trabalho', chefia: 'CLA', gerencia: 'L', admin: 'CLA' },
  parametros: { label: 'Parâmetros do sistema', chefia: 'LA', gerencia: 'L', admin: 'LA' },
  // 1 · Cadastro único
  especies: { label: 'Espécies', chefia: 'CLAE', gerencia: 'L', admin: 'CLAE' },
  recipientes: { label: 'Recipientes', chefia: 'CLAE', gerencia: 'L', admin: 'CLAE' },
  insumos: { label: 'Insumos', chefia: 'CLAE', gerencia: 'L', admin: 'CLAE' },
  pessoas: { label: 'Pessoas', chefia: 'CLAE', gerencia: 'L', admin: 'CLAE' },
  dados_fiscais: { label: 'Dados fiscais de pessoa', chefia: 'CLA', gerencia: '', admin: 'CLA' },
  tipos_tarefa: { label: 'Tipos de tarefa', chefia: 'CL', gerencia: 'CLAE', admin: 'L' },
  areas_canteiros: { label: 'Áreas e canteiros', chefia: 'CL', gerencia: 'CLAE', admin: 'L' },
  protocolos: { label: 'Protocolo de atividades', chefia: 'CLA', gerencia: 'CLA', admin: 'L' },
  // 2 · Produção
  agenda: { label: 'Agenda da semana', chefia: 'L', gerencia: 'CLAE', admin: 'L' },
  fechamento_semana: { label: 'Fechamento da semana', chefia: 'L', gerencia: 'A', admin: 'L' },
  confirmacao_tarefa: { label: 'Confirmação de tarefa', chefia: 'L', gerencia: 'CLA', admin: 'L' },
  lotes: { label: 'Lotes', chefia: 'L', gerencia: 'CLA', admin: 'L' },
  movimentos_lote: { label: 'Movimentos de lote', chefia: 'L', gerencia: 'CL', admin: 'L' },
  divisao_lote: { label: 'Divisão de lote', chefia: 'L', gerencia: 'C', admin: 'L' },
  perdas: { label: 'Perdas', chefia: 'L', gerencia: 'CL', admin: 'L' },
  analise_perdas: { label: 'Análise de perdas', chefia: 'L', gerencia: 'L', admin: 'L' },
  mapa_lotes: { label: 'Mapa de lotes', chefia: 'L', gerencia: 'L', admin: 'L' },
  estoque_disponivel: { label: 'Estoque disponível', chefia: 'L', gerencia: 'L', admin: 'L' },
  // 3 · Comercial
  pedidos: { label: 'Pedidos', chefia: 'CLAE', gerencia: 'L', admin: 'CLAE' },
  confirmacao_pedido: { label: 'Confirmação de pedido', chefia: 'A', gerencia: 'A', admin: 'A' },
  verificacao_pedido: { label: 'Verificação de pedido', chefia: 'CLA', gerencia: 'CLA', admin: 'CLA' },
  cargas_pedido: { label: 'Cargas do pedido', chefia: 'CLA', gerencia: 'CLA', admin: 'CLA' },
} as const satisfies Record<string, Regra>;

export type Recurso = keyof typeof ACCESS_MATRIX;

export function can(perfil: Perfil, recurso: Recurso, operacao: Operacao): boolean {
  // D4 §1.1: na implementação o admin tem acesso irrestrito. É o único ponto do código que decide isso.
  if (perfil === 'admin') return true;
  const letters: string = ACCESS_MATRIX[recurso][perfil];
  return letters.includes(operacao);
}
