import type { FormState } from './form-state';

/**
 * Tipos do cadastro rápido de espécie que o navegador usa. Separado de
 * `especies.ts` para o SQL não ir junto para o cliente (RNF-11, TA-60), como em
 * `pessoas-form.ts`.
 */

export interface EspecieRef {
  id: string;
  /** O nome de tela: o popular principal, ou o científico quando não há popular. */
  nome: string;
  nomeCientifico: string;
  nomesPopulares: string[];
}

export interface EspecieRapidaState extends FormState {
  /** Preenchido uma vez, com a espécie criada ou reaproveitada. */
  especie?: EspecieRef;
  /** A espécie que já existia com esse nome, e que a tela usa em vez de duplicar. */
  existente?: EspecieRef;
}

export const EMPTY_ESPECIE_RAPIDA_STATE: EspecieRapidaState = {};

export interface NomePopularState extends FormState {
  /** O nome que acabou de ser aprendido, para a tela mostrá-lo sem recarregar. */
  nomeSalvo?: { especieId: string; nome: string };
}

export const EMPTY_NOME_POPULAR_STATE: NomePopularState = {};
