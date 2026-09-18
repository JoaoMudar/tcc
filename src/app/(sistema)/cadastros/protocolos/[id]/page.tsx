import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import pool from '@/lib/db';
import { FASES, FASES_EDITAVEIS } from '@/lib/lotes-rotulos';
import { can } from '@/lib/permissions';
import { TIPOS_AGENDAMENTO, TIPOS_ANCORA, resumoAgendamento } from '@/lib/protocolo-rotulos';
import { findProtocolo, listEtapas } from '@/lib/protocolos';
import { listTiposTarefa } from '@/lib/tipos-tarefa';
import { listTurnos, turnoLabel } from '@/lib/turnos';
import { isUuid } from '@/lib/uuid';
import { requirePageAccess } from '@/lib/auth/guards';
import { EtapaForm } from '../EtapaForm';
import { ProtocoloForm } from '../ProtocoloForm';

/** UC-17: a lista ordenada de etapas. O que esta tela não pode é esconder a âncora. */
export default async function ProtocoloPage({ params, searchParams }: PageProps<'/cadastros/protocolos/[id]'>) {
  const user = await requirePageAccess('protocolos');
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const protocolo = await findProtocolo(pool, id);
  if (!protocolo) notFound();

  const [etapas, tipos, turnos] = await Promise.all([listEtapas(pool, id), listTiposTarefa(pool), listTurnos(pool)]);
  const salvo = (await searchParams).salvo === '1';
  const podeEditar = can(user.perfil, 'protocolos', 'A');
  const podeCriar = can(user.perfil, 'protocolos', 'C');

  const opcoes = {
    tipos: tipos.filter((t) => t.ativo).map((t) => ({ value: t.id, label: t.nome })),
    turnos: turnos.filter((t) => t.ativo).map((t) => ({ value: t.id, label: `${turnoLabel(t.nome)} · ${t.inicio}` })),
    // A lista de âncoras não inclui a própria etapa: é a metade da FE-1 que a tela resolve
    ancoras: etapas.map((e) => ({ value: e.id, label: e.rotulo })),
    fases: FASES_EDITAVEIS.map((fase) => ({ value: fase, label: FASES[fase] })),
  };

  return (
    <main>
      <PageHeader area="1 · Cadastros" title={protocolo.nome} />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros/protocolos" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        {salvo && <Notice tone="success">Protocolo criado. Acrescente as etapas abaixo.</Notice>}
        {!podeEditar && <Notice tone="info">Seu perfil pode consultar este protocolo, mas não alterá-lo.</Notice>}

        <ProtocoloForm protocolo={protocolo} podeEditar={podeEditar} />

        <h2 className="mt-4 text-sm font-bold tracking-widest text-muted uppercase">Etapas</h2>
        {etapas.length === 0 && (
          <p className="text-base text-muted">
            Nenhuma etapa. O lote deste recipiente é criado e não cobra etapa nenhuma.
          </p>
        )}

        {etapas.map((etapa) => (
          <details key={etapa.id} className={`rounded-xl border border-line bg-white ${etapa.ativo ? '' : 'opacity-60'}`}>
            <summary className="flex min-h-touch cursor-pointer flex-col justify-center gap-1 p-4">
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">
                  {etapa.posicao}. {etapa.rotulo}
                </span>
                <span className="flex gap-2">
                  {!etapa.alertaLigado && <Pill tone="neutral">sem alerta</Pill>}
                  {!etapa.ativo && <Pill tone="neutral">fora de uso</Pill>}
                  <Pill tone={etapa.tipoAgendamento === 'sequencial' ? 'blue' : 'green'}>
                    {TIPOS_AGENDAMENTO[etapa.tipoAgendamento]}
                  </Pill>
                </span>
              </span>
              <span className="text-sm text-muted">
                {etapa.tipoTarefa} · {resumoAgendamento(etapa)}
              </span>
              {/* A âncora fica visível na lista fechada, e não só dentro do formulário */}
              <span className="text-sm text-muted">
                Conta de: {etapa.tipoAncora === 'criacao_do_lote' ? TIPOS_ANCORA.criacao_do_lote : etapa.etapaAncoraRotulo}
                {etapa.faseResultante && ` · avança para ${FASES[etapa.faseResultante]}`}
              </span>
            </summary>
            <div className="border-t border-line p-4">
              <EtapaForm protocoloId={protocolo.id} etapa={etapa} opcoes={opcoes} podeEditar={podeEditar} />
            </div>
          </details>
        ))}

        {podeCriar && (
          <>
            <h2 className="mt-4 text-sm font-bold tracking-widest text-muted uppercase">Nova etapa</h2>
            {opcoes.tipos.length === 0 || opcoes.turnos.length === 0 ? (
              <Notice tone="warning">
                Antes de montar o protocolo, cadastre tipo de tarefa e turno de trabalho.
              </Notice>
            ) : (
              <EtapaForm protocoloId={protocolo.id} opcoes={opcoes} podeEditar />
            )}
          </>
        )}
      </div>
    </main>
  );
}
