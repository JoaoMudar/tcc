import 'server-only';
import { formText } from './form-state';
import { resolverLocalizacao } from './localizacao-servidor';
import type { EnderecoDeEntrega } from './pessoas';
import { lerCoordenada } from './rotas';
import { type EnderecoDoPonto, MapaIndisponivel, enderecoDoPonto } from './rotas-ors';

/** O que volta para o form quando dá erro, para não perder o digitado. */
export type CamposDoEndereco = {
  endereco: string;
  localizacao: string;
};

/** O rótulo da lista ("Rua X, 120, Rio do Sul, SC, Brasil") sem a cidade e o resto, que vão nos próprios campos. */
function logradouroDoRotulo(rotulo: string, cidade: string | null): string {
  const partes = rotulo.split(',').map((parte) => parte.trim());
  const ondeCidade = cidade ? partes.findIndex((parte) => parte.toLowerCase() === cidade.toLowerCase()) : -1;
  return ondeCidade > 0 ? partes.slice(0, ondeCidade).join(', ') : rotulo;
}

async function lugarDoPonto(ponto: { lat: number; lng: number }): Promise<EnderecoDoPonto | null> {
  try {
    return await enderecoDoPonto(ponto);
  } catch (error) {
    if (error instanceof MapaIndisponivel) return null;
    throw error;
  }
}

/**
 * P17: o form do endereço de entrega que falta, o mesmo na rota do planejar e
 * no frete do pedido. Vale o endereço digitado (com ou sem escolher na lista)
 * ou a localização que o cliente mandou pelo WhatsApp, colada; com as duas, o
 * ponto colado é o que vale, e o texto fica como referência.
 */
export async function lerEnderecoDeEntrega(
  formData: FormData,
): Promise<{ error: string; fields: CamposDoEndereco } | { endereco: EnderecoDeEntrega; fields: CamposDoEndereco }> {
  const texto = formText(formData, 'endereco').trim().slice(0, 300);
  const colado = formText(formData, 'localizacao').trim().slice(0, 2000);
  const fields: CamposDoEndereco = { endereco: texto, localizacao: colado };

  let ponto = lerCoordenada(formText(formData, 'lat'), formText(formData, 'lng'));
  let doWhatsApp = false;
  if (colado !== '') {
    ponto = await resolverLocalizacao(colado);
    if (!ponto) {
      return {
        error: 'Não deu para ler a localização. Cole o link que o cliente mandou pelo WhatsApp, ou os dois números.',
        fields,
      };
    }
    doWhatsApp = true;
  }
  if (!texto && !ponto) return { error: 'Digite o endereço ou cole a localização.', fields };

  const lugar = ponto ? await lugarDoPonto(ponto) : null;
  const logradouro = texto
    ? doWhatsApp
      ? texto
      : logradouroDoRotulo(texto, lugar?.cidade ?? null)
    : (lugar?.logradouro ?? 'Localização enviada pelo WhatsApp');

  return {
    endereco: { logradouro, cidade: lugar?.cidade ?? null, uf: lugar?.uf ?? null, cep: lugar?.cep ?? null, ponto },
    fields,
  };
}
