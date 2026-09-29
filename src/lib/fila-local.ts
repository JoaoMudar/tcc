import type { TipoEnvio } from './envios';

/**
 * A fila do aparelho (T9.3, RNF-05). Guarda **só o que foi digitado e ainda não
 * chegou ao servidor**, nunca cópia do banco (E4 A-08): um registro de perda na
 * fila não revela preço nem cliente. Fica no IndexedDB para sobreviver ao
 * recarregar a página e ao fechar o navegador (TA-59).
 */

export type SituacaoPendente = 'pendente' | 'recusado';

export interface RegistroPendente {
  /** A chave de idempotência, gerada aqui e mandada em toda tentativa. */
  chave: string;
  tipo: TipoEnvio;
  campos: Record<string, string>;
  /** O que a pessoa lê no indicador: "Perda de 30 no lote 2026-0012". */
  rotulo: string;
  criadoEm: string;
  situacao: SituacaoPendente;
  /** Por que o servidor recusou, ou por que ainda não foi (sessão vencida). */
  mensagem?: string;
}

const BANCO = 'viveiro-fila';
const LOJA = 'pendentes';
export const EVENTO_FILA = 'viveiro:fila';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA, { keyPath: 'chave' });
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function naLoja<T>(modo: IDBTransactionMode, operar: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const banco = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transacao = banco.transaction(LOJA, modo);
      const pedido = operar(transacao.objectStore(LOJA));
      transacao.oncomplete = () => resolve(pedido.result);
      transacao.onerror = () => reject(transacao.error);
      transacao.onabort = () => reject(transacao.error);
    });
  } finally {
    banco.close();
  }
}

/** Avisa o indicador e os formulários abertos de que a fila mudou. */
function avisar() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_FILA));
}

export async function enfileirar(registro: Omit<RegistroPendente, 'situacao' | 'criadoEm'>): Promise<void> {
  await naLoja('readwrite', (loja) => loja.put({ ...registro, situacao: 'pendente', criadoEm: new Date().toISOString() }));
  avisar();
}

/** Em ordem de criação: a perda feita antes vai antes, como aconteceu no canteiro. */
export async function listar(): Promise<RegistroPendente[]> {
  const todos = await naLoja<RegistroPendente[]>('readonly', (loja) => loja.getAll());
  return todos.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

export async function remover(chave: string): Promise<void> {
  await naLoja('readwrite', (loja) => loja.delete(chave));
  avisar();
}

export async function atualizar(chave: string, mudanca: Pick<RegistroPendente, 'situacao'> & { mensagem?: string }): Promise<void> {
  const atual = await naLoja<RegistroPendente | undefined>('readonly', (loja) => loja.get(chave));
  if (!atual) return;
  await naLoja('readwrite', (loja) => loja.put({ ...atual, ...mudanca }));
  avisar();
}

/** Ao sair: o aparelho que troca de mão não leva o que o anterior digitou (E4 A-08). */
export async function limpar(): Promise<void> {
  await naLoja('readwrite', (loja) => loja.clear());
  avisar();
}
