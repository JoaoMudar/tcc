import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import pool from '@/lib/db';
import { can } from '@/lib/permissions';
import { listProtocolos } from '@/lib/protocolos';
import { formatVolume, listRecipientes } from '@/lib/recipientes';
import { requirePageAccess } from '@/lib/auth/guards';
import { NovoProtocoloForm } from './NovoProtocoloForm';

/** UC-17: a receita de manejo pertence ao recipiente (RN-30), e montar é raro, ler é frequente. */
export default async function ProtocolosPage() {
  const user = await requirePageAccess('protocolos');
  const [protocolos, recipientes] = await Promise.all([listProtocolos(pool), listRecipientes(pool)]);
  const podeCriar = can(user.perfil, 'protocolos', 'C');

  // FE-3: um vigente por recipiente. A tela não oferece o que o banco recusaria.
  const comVigente = new Set(protocolos.filter((p) => p.ativo).map((p) => p.recipienteId));
  const disponiveis = recipientes
    .filter((r) => r.ativo && !comVigente.has(r.id))
    .map((r) => ({
      value: r.id,
      label: r.volumeLitros === null ? r.nome : `${r.nome} · ${formatVolume(r.volumeLitros)}`,
    }));

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Protocolos de atividades" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        <Link href="/cadastros" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {!podeCriar && <Notice tone="info">Seu perfil pode consultar os protocolos, mas não alterá-los.</Notice>}

        {protocolos.map((protocolo) => (
          <Link
            key={protocolo.id}
            href={`/cadastros/protocolos/${protocolo.id}`}
            className={`flex flex-col gap-1 rounded-xl border border-line bg-white p-4 active:bg-brand-light ${
              protocolo.ativo ? '' : 'opacity-60'
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold text-ink">{protocolo.nome}</span>
              {protocolo.ativo ? <Pill tone="green">vigente</Pill> : <Pill tone="neutral">fora de uso</Pill>}
            </span>
            <span className="text-sm text-muted">
              {protocolo.recipiente} · {protocolo.etapas === 1 ? '1 etapa' : `${protocolo.etapas} etapas`}
            </span>
          </Link>
        ))}
        {protocolos.length === 0 && (
          <p className="text-base text-muted">
            Nenhum protocolo montado. Sem ele, o lote é criado e não cobra etapa nenhuma.
          </p>
        )}

        {podeCriar && (
          <>
            <h2 className="mt-6 text-sm font-bold tracking-widest text-muted uppercase">Novo protocolo</h2>
            {disponiveis.length === 0 ? (
              <Notice tone="info">Todos os recipientes em uso já têm protocolo vigente.</Notice>
            ) : (
              <NovoProtocoloForm recipientes={disponiveis} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
