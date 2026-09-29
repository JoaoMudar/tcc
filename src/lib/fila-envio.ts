import { type RegistroPendente, atualizar, listar, remover } from './fila-local';

/**
 * O envio da fila do aparelho (T9.3, T9.4). Cada resposta da rota vira um de
 * quatro desfechos, e cada desfecho diz o que fazer com o registro guardado.
 */

export type Desfecho =
  | { tipo: 'gravado'; success: string; destino?: string }
  /** O servidor recusou (regra, validação, perfil): repetir não resolve, a pessoa decide. */
  | { tipo: 'recusado'; error: string; fields?: Record<string, string> }
  /** Sessão vencida: fica guardado até a pessoa entrar de novo. */
  | { tipo: 'sem_sessao'; error: string }
  /** Sem rede ou servidor fora: fica guardado e vai sozinho na próxima tentativa. */
  | { tipo: 'sem_rede' };

export const ROTA_REGISTROS = '/api/registros';
const SEM_SESSAO = 'Sua sessão terminou. Entre de novo para enviar.';

type Envio = Pick<RegistroPendente, 'chave' | 'tipo' | 'campos'>;

async function lerJson(resposta: Response): Promise<Record<string, unknown>> {
  try {
    const corpo: unknown = await resposta.json();
    return typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function classificar(resposta: Response): Promise<Desfecho> {
  // Sem cookie, o proxy responde com redirecionamento para o login, e não com 401
  if (resposta.type === 'opaqueredirect' || resposta.status === 401) {
    const corpo = await lerJson(resposta);
    return { tipo: 'sem_sessao', error: typeof corpo.error === 'string' ? corpo.error : SEM_SESSAO };
  }
  const corpo = await lerJson(resposta);
  if (resposta.ok && typeof corpo.success === 'string') {
    return { tipo: 'gravado', success: corpo.success, destino: typeof corpo.destino === 'string' ? corpo.destino : undefined };
  }
  if (resposta.status >= 400 && resposta.status < 500) {
    return {
      tipo: 'recusado',
      error: typeof corpo.error === 'string' ? corpo.error : 'O registro foi recusado.',
      fields: (corpo.fields as Record<string, string> | undefined) ?? undefined,
    };
  }
  return { tipo: 'sem_rede' };
}

export async function enviar(envio: Envio, buscar: typeof fetch = fetch): Promise<Desfecho> {
  let resposta: Response;
  try {
    resposta = await buscar(ROTA_REGISTROS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envio),
      credentials: 'same-origin',
      redirect: 'manual',
    });
  } catch {
    return { tipo: 'sem_rede' };
  }
  return classificar(resposta);
}

// Um envio por chave de cada vez: o formulário e o esvaziamento da fila podem
// tentar o mesmo registro juntos, e a segunda tentativa espera a primeira.
const emVoo = new Map<string, Promise<Desfecho>>();

/**
 * Envia um registro guardado e resolve o que fica na fila conforme o desfecho.
 * `recusadoSai`: quem enviou está com o formulário aberto e mostra a recusa ali,
 * com os campos para corrigir; guardar a recusa no indicador seria dizer duas vezes.
 */
export function enviarGuardado(envio: Envio, opcoes: { recusadoSai?: boolean; buscar?: typeof fetch } = {}): Promise<Desfecho> {
  const { recusadoSai = false, buscar = fetch } = opcoes;
  const andando = emVoo.get(envio.chave);
  if (andando) return andando;
  const promessa = (async () => {
    const desfecho = await enviar(envio, buscar);
    // A fila pode não existir (navegador sem IndexedDB): o desfecho vale mesmo assim
    const guardar = (passo: Promise<void>) => passo.catch(() => undefined);
    if (desfecho.tipo === 'gravado' || (desfecho.tipo === 'recusado' && recusadoSai)) await guardar(remover(envio.chave));
    else if (desfecho.tipo === 'recusado') await guardar(atualizar(envio.chave, { situacao: 'recusado', mensagem: desfecho.error }));
    else if (desfecho.tipo === 'sem_sessao') await guardar(atualizar(envio.chave, { situacao: 'pendente', mensagem: desfecho.error }));
    return desfecho;
  })().finally(() => emVoo.delete(envio.chave));
  emVoo.set(envio.chave, promessa);
  return promessa;
}

let esvaziando: Promise<{ enviados: number }> | null = null;

/**
 * Manda os pendentes em ordem de criação, um de cada vez. Para no primeiro sem
 * rede ou sem sessão: os seguintes dariam no mesmo. O recusado não é reenviado,
 * espera a pessoa descartar.
 */
export function esvaziarFila(buscar: typeof fetch = fetch): Promise<{ enviados: number }> {
  esvaziando ??= (async () => {
    let enviados = 0;
    for (const registro of await listar()) {
      if (registro.situacao !== 'pendente') continue;
      const desfecho = await enviarGuardado(registro, { buscar });
      if (desfecho.tipo === 'gravado') enviados++;
      if (desfecho.tipo === 'sem_rede' || desfecho.tipo === 'sem_sessao') break;
    }
    return { enviados };
  })().finally(() => {
    esvaziando = null;
  });
  return esvaziando;
}
