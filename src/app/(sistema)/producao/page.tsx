import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { type Recurso, can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';

const SECOES: readonly { href: string; title: string; description: string; recurso: Recurso }[] = [
  {
    href: '/producao/lotes',
    title: 'Lotes',
    description: 'O viveiro por área e canteiro: o que tem em cada um, e os livres.',
    recurso: 'lotes',
  },
  { href: '/producao/perdas', title: 'Perdas', description: 'Perdas por período, espécie e causa, e a mortalidade de cada lote.', recurso: 'analise_perdas' },
  { href: '/producao/saldo', title: 'Muda pronta', description: 'Quanto há pronto para vender, por espécie e recipiente.', recurso: 'estoque_disponivel' },
];

/** 2 · Produção. As abas agenda e mapa entram com a agenda da semana (T5.7). */
export default async function ProducaoPage() {
  const user = await requirePageAccess('agenda');

  return (
    <main>
      <PageHeader area="2 · Produção" title="Produção" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        {SECOES.filter((secao) => can(user.perfil, secao.recurso, 'L')).map((secao) => (
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
