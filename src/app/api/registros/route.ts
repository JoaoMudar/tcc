import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/lib/auth/session';
import { FORBIDDEN_MESSAGE } from '@/lib/auth/guards';
import { isTipoEnvio } from '@/lib/envios';
import { type Campos, processarRegistro } from '@/lib/registros-campo';
import { isUuid } from '@/lib/uuid';

/**
 * Porta da fila do aparelho (T9.3, RNF-05): perda, contagem e confirmação de
 * tarefa, com a chave de idempotência gerada no aparelho.
 *
 * **Rota fixa, e não Server Action**: o identificador da action muda a cada
 * publicação, e um registro guardado ontem, sem rede, falharia ao ser enviado
 * depois de uma atualização do sistema.
 *
 * A resposta diz à fila o que fazer: 200 gravado (ou já gravado antes), 422
 * recusado com a mensagem, 401 sem sessão, 403 perfil sem permissão. Qualquer
 * outra falha lança e vira 500, e a fila tenta de novo.
 */
export async function POST(request: Request) {
  // Guard da rota: sessão e permissão no servidor, como em toda Server Action (RF-06)
  const session = await getCurrentSession();
  if (!session || session.deveTrocarSenha) {
    return Response.json({ error: 'Sua sessão terminou. Entre de novo para enviar.' }, { status: 401 });
  }

  // Só JSON: formulário de outro site não consegue mandar este tipo sem a checagem prévia do navegador
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ error: 'Registro ilegível.' }, { status: 415 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ error: 'Registro ilegível.' }, { status: 400 });
  }
  const { chave, tipo, campos } = (corpo ?? {}) as { chave?: unknown; tipo?: unknown; campos?: unknown };
  if (!isUuid(chave) || !isTipoEnvio(tipo) || !camposValidos(campos)) {
    return Response.json({ error: 'Registro ilegível.' }, { status: 400 });
  }

  const resultado = await processarRegistro(tipo, chave, campos, session);
  switch (resultado.status) {
    case 'proibido':
      return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    case 'recusado':
      return Response.json({ error: resultado.error, fields: resultado.fields }, { status: 422 });
    case 'gravado':
      // Ocupação, ficha, perdas, estoque disponível e agenda leem o que acabou de mudar
      revalidatePath('/producao', 'layout');
      return Response.json({ success: resultado.success, destino: resultado.destino, repetido: resultado.repetido });
  }
}

function camposValidos(valor: unknown): valor is Campos {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    !Array.isArray(valor) &&
    Object.values(valor).every((v) => typeof v === 'string' && v.length <= 2000)
  );
}
