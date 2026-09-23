/**
 * IP de quem fez a requisição, para a sessão e o registro de acesso (RF-04).
 *
 * O cliente controla o começo de `X-Forwarded-For` e pode mandar o que quiser;
 * quem o proxy viu de verdade é o último item, o que ele próprio acrescentou
 * (SEC-005). Na Vercel a lista chega com um item só, reescrito pela plataforma.
 *
 * Isso só vale se houver proxy na frente: com `next start` exposto direto, o
 * cabeçalho inteiro é do cliente. Em servidor próprio, o Next ouve só em
 * 127.0.0.1 e o nginx reescreve o cabeçalho (SEC-008, D3 §6.1).
 */
export function clientIp(forwardedFor: string | null, realIp: string | null): string | null {
  const cadeia = forwardedFor?.split(',').map((parte) => parte.trim()).filter(Boolean) ?? [];
  const ip = cadeia.at(-1) || realIp?.trim() || null;
  // Endereço não passa de 45 caracteres (IPv6 com IPv4 embutido); o resto é lixo
  return ip ? ip.slice(0, 45) : null;
}
