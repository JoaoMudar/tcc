import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ModalDeRota } from '@/components/ui/ModalDeRota';

interface TelaDeTarefaProps {
  titulo: string;
  /** Aberta da agenda, por cima dela (rota interceptada); pelo endereço, página inteira. */
  emModal: boolean;
  /** O "Voltar" da página inteira; no modal, quem volta é o fechar. */
  voltar: { href: string; rotulo?: string };
  children: ReactNode;
}

/** A moldura das telas de tarefa: o mesmo conteúdo, em modal ou em página. */
export function TelaDeTarefa({ titulo, emModal, voltar, children }: TelaDeTarefaProps) {
  if (emModal) {
    return (
      <ModalDeRota titulo={titulo}>
        <div className="flex flex-col gap-4">{children}</div>
      </ModalDeRota>
    );
  }
  return (
    <main>
      <PageHeader area="2 · Produção" title={titulo} />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href={voltar.href} className="text-base font-semibold text-brand-dark">
          {voltar.rotulo ?? 'Voltar'}
        </Link>
        {children}
      </div>
    </main>
  );
}
