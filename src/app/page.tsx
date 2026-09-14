import Link from 'next/link';
import { connection } from 'next/server';
import { PageHeader } from '@/components/PageHeader';
import { NAV_ITEMS } from '@/components/nav-items';
import { Notice } from '@/components/ui/Notice';
import { isDatabaseReachable } from '@/lib/health';

export default async function HomePage() {
  // Consulta a cada acesso, e não uma vez no build
  await connection();
  const reachable = await isDatabaseReachable();

  return (
    <main>
      <PageHeader area="Viveiro Mudar" title="Início" />
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
        {reachable ? (
          <Notice tone="success">Banco de dados conectado.</Notice>
        ) : (
          <Notice tone="error">Sem conexão com o banco de dados. Avise o administrador.</Notice>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-20 items-center rounded-xl border border-line bg-white px-5 text-lg font-bold text-ink active:bg-brand-light"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
