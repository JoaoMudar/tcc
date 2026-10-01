import type { CategoriaTarefa } from './tipos-tarefa';

/**
 * A cor da agenda tem um significado só: a categoria do tipo de tarefa, numa
 * barra de 4px à esquerda do card. A conclusão não usa cor de fundo, e sim o
 * ícone, para as duas leituras não se misturarem (RNF-04).
 *
 * Seis cores de saturação média, todas com contraste de ao menos 3:1 sobre o
 * branco (elemento gráfico, WCAG 1.4.11), e longe do verde, do âmbar e do
 * vermelho que os ícones de conclusão usam (o plantio fica no azul-esverdeado, e não no verde do feito).
 */
export const COR_CATEGORIA: Record<CategoriaTarefa, string> = {
  semente: 'bg-yellow-700',
  terra: 'bg-orange-800',
  plantio: 'bg-teal-700',
  manutencao: 'bg-sky-600',
  pos_morte: 'bg-slate-500',
  expedicao: 'bg-violet-600',
};

/**
 * O fundo do card no Gantt da semana: a mesma cor, só tingida (8%), para o card
 * se agrupar com os da mesma categoria sem competir com o texto.
 */
export const FUNDO_CATEGORIA: Record<CategoriaTarefa, string> = {
  semente: 'bg-yellow-700/[0.08]',
  terra: 'bg-orange-800/[0.08]',
  plantio: 'bg-teal-700/[0.08]',
  manutencao: 'bg-sky-600/[0.08]',
  pos_morte: 'bg-slate-500/[0.08]',
  expedicao: 'bg-violet-600/[0.08]',
};
