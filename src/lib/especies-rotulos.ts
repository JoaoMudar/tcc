import type { StatusValidacao } from './especies';

/** RF-69: a situação do nome na ficha, sem palavra técnica (RN-68). */
export const ROTULO_VALIDACAO: Record<StatusValidacao, string> = {
  validado: 'Nome conferido na Flora do Brasil',
  pendente: 'Nome ainda não conferido',
  a_identificar: 'Planta ainda sem identificação',
  fora_da_ffb: 'Planta que a Flora do Brasil não lista',
};
