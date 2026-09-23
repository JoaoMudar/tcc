import Link from 'next/link';
import { Notice } from '@/components/ui/Notice';
import type { TempoDaEspecie } from '@/lib/protocolos';
import { TempoProtocoloForm } from './TemposProtocoloForm';

interface SecaoProps {
  especieId: string;
  tempos: readonly TempoDaEspecie[];
  podeEditar: boolean;
}

/**
 * UC-18: a espécie de germinação lenta usa setenta dias onde o protocolo diz
 * quarenta, sem duplicar a receita inteira (RF-25, RN-36).
 */
export function TemposProtocoloSecao({ especieId, tempos, podeEditar }: SecaoProps) {
  if (tempos.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="mt-4 text-sm font-bold tracking-widest text-muted uppercase">Tempos do protocolo</h2>
        <Notice tone="info">
          Nenhum protocolo vigente tem etapa ativa.{' '}
          <Link href="/cadastros/protocolos" className="font-semibold underline">
            Montar protocolo
          </Link>
        </Notice>
      </section>
    );
  }

  const porProtocolo = new Map<string, TempoDaEspecie[]>();
  for (const tempo of tempos) {
    const lista = porProtocolo.get(tempo.protocolo) ?? [];
    lista.push(tempo);
    porProtocolo.set(tempo.protocolo, lista);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="mt-4 text-sm font-bold tracking-widest text-muted uppercase">Tempos do protocolo</h2>
      <p className="text-sm text-muted">
        O que ficar em branco vem do protocolo do recipiente. Preencher aqui vale só para esta espécie.
      </p>
      {!podeEditar && <Notice tone="info">Seu perfil pode consultar os tempos, mas não alterá-los.</Notice>}

      {[...porProtocolo.entries()].map(([protocolo, doProtocolo]) => (
        <div key={protocolo} className="flex flex-col gap-3">
          <h3 className="mt-2 text-sm font-semibold text-ink">{protocolo}</h3>
          {doProtocolo.map((tempo) => (
            <TempoProtocoloForm
              key={tempo.protocoloEtapaId}
              especieId={especieId}
              tempo={tempo}
              podeEditar={podeEditar}
            />
          ))}
        </div>
      ))}
    </section>
  );
}
