import 'server-only';
import { type Ponto, ehDestinoDoMaps, lerLocalizacao, linkCurto } from './localizacao';

const SALTOS = 3;
const TEMPO_LIMITE_MS = 5000;

/**
 * P17: a localização colada, com o link curto (`maps.app.goo.gl`) resolvido.
 *
 * O link curto só diz o ponto depois do redirecionamento, e é o servidor que
 * o segue. **Só o Google Maps é seguido**: o encurtador e os domínios do Maps,
 * no máximo três saltos, sem ler o corpo de nada. Sem isso, o campo viraria uma
 * porta para o servidor buscar endereço qualquer da rede interna (SSRF).
 */
export async function resolverLocalizacao(texto: string): Promise<Ponto | null> {
  const direto = lerLocalizacao(texto);
  if (direto) return direto;

  let url = linkCurto(texto);
  for (let salto = 0; url && salto < SALTOS; salto++) {
    let resposta: Response;
    try {
      resposta = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TEMPO_LIMITE_MS), cache: 'no-store' });
    } catch {
      return null;
    }
    const destino = resposta.headers.get('location');
    if (!destino) return null;
    let proxima: URL;
    try {
      proxima = new URL(destino, url);
    } catch {
      return null;
    }
    if (!ehDestinoDoMaps(proxima)) return null;
    const achado = lerLocalizacao(proxima.href);
    if (achado) return achado;
    url = proxima;
  }
  return null;
}
