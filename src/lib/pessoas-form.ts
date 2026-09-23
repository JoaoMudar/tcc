import type { TipoPessoa } from './documento';
import type { FormState } from './form-state';

/**
 * Rótulos, tipos e estados de pessoa que o formulário no navegador usa.
 * Separado de `pessoas.ts` para o SQL não ir junto para o cliente.
 */

export type { TipoPessoa };
export type Papel = 'cliente' | 'fornecedor' | 'funcionario';
export type TipoVinculo = 'fixo' | 'diarista';
export type TipoEndereco = 'entrega' | 'cobranca' | 'residencial';

export const TIPO_PESSOA_LABELS: Record<TipoPessoa, string> = { pf: 'Pessoa física', pj: 'Pessoa jurídica' };
export const PAPEL_LABELS: Record<Papel, string> = { cliente: 'Cliente', fornecedor: 'Fornecedor', funcionario: 'Funcionário' };
export const VINCULO_LABELS: Record<TipoVinculo, string> = { fixo: 'Fixo', diarista: 'Diarista' };
export const ENDERECO_LABELS: Record<TipoEndereco, string> = {
  entrega: 'Endereço de entrega',
  residencial: 'Endereço residencial',
  cobranca: 'Endereço de cobrança',
};
export const PAPEIS = Object.keys(PAPEL_LABELS) as Papel[];
/** Os endereços que qualquer perfil que lê a pessoa pode ver. */
export const ENDERECOS_COMUNS: readonly TipoEndereco[] = ['entrega', 'residencial'];
/** O endereço que é dado fiscal (D4 §3.1). */
export const ENDERECO_FISCAL: TipoEndereco = 'cobranca';

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const;

export interface PapelPessoa {
  papel: Papel;
  tipoVinculo: TipoVinculo | null;
}

export interface Endereco {
  tipo: TipoEndereco;
  logradouro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

export interface PessoaResumo {
  id: string;
  tipo: TipoPessoa;
  nome: string;
  telefone: string | null;
  ativa: boolean;
  papeis: PapelPessoa[];
  temAcesso: boolean;
  /** Presente só quando a leitura foi feita com `verFiscal`. */
  documento?: string | null;
}

export interface PessoaFicha extends PessoaResumo {
  email: string | null;
  observacoes: string | null;
  enderecos: Endereco[];
}

export function enderecoFieldName(tipo: TipoEndereco, campo: 'logradouro' | 'cidade' | 'uf' | 'cep'): string {
  return `endereco_${tipo}_${campo}`;
}

export interface PessoaRef {
  id: string;
  nome: string;
}

export interface PessoaFormState extends FormState {
  /** Pessoas com o mesmo telefone: a tela pergunta antes de criar outra (RF-14). */
  candidatas?: PessoaRef[];
  /** Dona do documento digitado. */
  existente?: PessoaRef;
  /** Cadastro aberto de dentro do pedido: o cliente pronto para ele usar. */
  cliente?: PessoaRef;
}

export interface ClienteRapidoState extends FormState {
  candidatas?: PessoaRef[];
  /** Cliente pronto para o pedido usar. */
  cliente?: PessoaRef;
}

export const EMPTY_PESSOA_STATE: PessoaFormState = {};
export const EMPTY_CLIENTE_RAPIDO_STATE: ClienteRapidoState = {};
