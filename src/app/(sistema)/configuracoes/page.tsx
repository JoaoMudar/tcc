import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { requirePageAccess } from '@/lib/auth/guards';

const SECOES = [
  {
    href: '/configuracoes/periodo',
    title: 'Período de trabalho',
    description: 'Início e fim de cada turno: a jornada padrão da agenda.',
  },
  {
    href: '/configuracoes/parametros',
    title: 'Parâmetros do sistema',
    description: 'Limite de mortalidade e os dias de atraso que pintam o lote no mapa.',
  },
];

/** F1 módulo Configurações: as duas telas que a operação ajusta sem implantação (RN-26). */
export default async function ConfiguracoesPage() {
  await requirePageAccess('parametros');

  return (
    <main>
      <PageHeader area="Configurações" title="Configurações" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        {SECOES.map((secao) => (
          <Link
            key={secao.href}
            href={secao.href}
            className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4 active:bg-brand-light"
          >
            <span className="text-lg font-semibold text-ink">{secao.title}</span>
            <span className="text-sm text-muted">{secao.description}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
