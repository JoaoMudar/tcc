import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Sem conexão · Viveiro Mudar' };

/**
 * O que o service worker mostra quando não há rede e a página pedida não tem
 * cópia no aparelho (T9.2). Estática e sem sessão: é guardada na instalação, e
 * não pode depender de nada que só venha do servidor.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Sem conexão</h1>
      <p className="text-base text-ink">Esta tela precisa de rede para abrir.</p>
      <p className="text-base text-muted">
        Perda, contagem e confirmação de tarefa feitas sem rede estão guardadas no aparelho e vão sozinhas quando a
        conexão voltar. A ficha do lote e a da tarefa que você já abriu continuam abrindo.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-touch w-full items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white"
      >
        Tentar de novo
      </Link>
    </main>
  );
}
