/*
 * Service worker do Viveiro Mudar (T9.2, RNF-05, RNF-23). Escrito à mão: o
 * next-pwa é plugin de webpack, e o Next 16 compila com turbopack.
 *
 * O QUE GUARDA, E SÓ ISSO (E4 A-08):
 * - a casca: arquivos de /_next/static (têm hash no nome, nunca mudam), ícones
 *   e manifest;
 * - a página /offline, para toda navegação sem rede que não tenha cópia;
 * - a última versão visitada da ficha do lote e da tarefa, que são as páginas
 *   dos três formulários de campo. Sem elas, recarregar sem rede perderia o
 *   formulário (TA-59). Nenhuma outra página é guardada: nada de pedido, cliente
 *   ou dado fiscal fica no aparelho.
 *
 * O que NÃO passa por aqui: POST (a fila de registros é do IndexedDB, não do
 * cache), /api e as requisições de dados do Next (RSC).
 *
 * A ficha aberta por link interno pede para ser guardada ({ guardar: caminho }),
 * porque essa navegação não passa pelo evento de página.
 *
 * Sair do sistema manda a mensagem 'limpar', que apaga as páginas guardadas.
 */

const VERSAO = 'v1';
const CASCA = `casca-${VERSAO}`;
const PAGINAS = `paginas-${VERSAO}`;
const OFFLINE = '/offline';

// Ficha do lote e da tarefa, por identificador; nunca as listas nem os formulários de edição
const PAGINA_GUARDADA = /^\/producao\/(lotes|agenda)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CASCA)
      .then((cache) => cache.addAll([OFFLINE, '/manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((nome) => nome !== CASCA && nome !== PAGINAS).map((nome) => caches.delete(nome))))
      .then(() => self.clients.claim()),
  );
});

async function guardarPagina(caminho) {
  if (!PAGINA_GUARDADA.test(caminho)) return;
  try {
    const resposta = await fetch(caminho, { credentials: 'same-origin' });
    if (resposta.ok && !resposta.redirected) {
      const cache = await caches.open(PAGINAS);
      await cache.put(caminho, resposta);
    }
  } catch {
    // Sem rede: fica a cópia anterior, se houver
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'limpar') event.waitUntil(caches.delete(PAGINAS));
  // A ficha aberta por link interno chega como dados do Next, e não como página:
  // ela pede para ser guardada inteira, para abrir de novo sem rede
  else if (event.data && typeof event.data.guardar === 'string') event.waitUntil(guardarPagina(event.data.guardar));
});

function ehRsc(request) {
  return request.headers.get('RSC') === '1' || new URL(request.url).searchParams.has('_rsc');
}

async function primeiroCache(request) {
  const guardada = await caches.match(request);
  if (guardada) return guardada;
  const resposta = await fetch(request);
  if (resposta.ok) {
    const cache = await caches.open(CASCA);
    await cache.put(request, resposta.clone());
  }
  return resposta;
}

async function navegar(request, url) {
  const guardar = PAGINA_GUARDADA.test(url.pathname);
  try {
    const resposta = await fetch(request);
    // Redirecionada (sessão vencida, sem permissão) não é a ficha: não se guarda
    if (guardar && resposta.ok && !resposta.redirected) {
      const cache = await caches.open(PAGINAS);
      await cache.put(url.pathname, resposta.clone());
    }
    return resposta;
  } catch {
    if (guardar) {
      const guardada = await caches.match(url.pathname, { cacheName: PAGINAS });
      if (guardada) return guardada;
    }
    return (await caches.match(OFFLINE, { cacheName: CASCA })) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || ehRsc(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navegar(request, url));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icones/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(primeiroCache(request));
  }
});
