/**
 * O lado do navegador do aviso no celular: saber se o aparelho aceita, pedir a
 * permissão e inscrever. Nada aqui vai ao servidor; quem grava é a action.
 */

export type EstadoAviso =
  | 'carregando'
  /** Navegador sem push, ou app fora do modo instalado (o iPhone só avisa instalado) */
  | 'sem-suporte'
  | 'instalar'
  /** A pessoa recusou; só se desfaz nas configurações do navegador */
  | 'negado'
  | 'desligado'
  | 'ligado';

/** A chave VAPID chega em base64 de URL, e o `subscribe` quer os bytes. */
export function chaveEmBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const preenchido = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = preenchido.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function ehIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function instalado(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** O service worker só é registrado em produção; em dev, `ready` nunca resolveria. */
export async function registroDoApp(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration('/')) ?? null;
}

export async function estadoDoAviso(): Promise<EstadoAviso> {
  if (typeof window === 'undefined') return 'carregando';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // No iPhone o push existe, mas só com o app adicionado à tela de início
    return ehIos() && !instalado() ? 'instalar' : 'sem-suporte';
  }
  if (Notification.permission === 'denied') return 'negado';
  const registro = await registroDoApp();
  if (!registro) return 'sem-suporte';
  const inscricao = await registro.pushManager.getSubscription();
  return inscricao && Notification.permission === 'granted' ? 'ligado' : 'desligado';
}

/** Pede a permissão (precisa vir de um toque) e devolve a inscrição para o servidor guardar. */
export async function inscrever(chavePublica: string): Promise<PushSubscriptionJSON | 'negado' | null> {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return permissao === 'denied' ? 'negado' : null;
  const registro = await registroDoApp();
  if (!registro) return null;
  const inscricao =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(chavePublica) }));
  return inscricao.toJSON();
}

/** Desfaz no aparelho e devolve o endpoint, para o servidor apagar a linha. */
export async function desinscrever(): Promise<string | null> {
  const registro = await registroDoApp();
  const inscricao = await registro?.pushManager.getSubscription();
  if (!inscricao) return null;
  await inscricao.unsubscribe();
  return inscricao.endpoint;
}
