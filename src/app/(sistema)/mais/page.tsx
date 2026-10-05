import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { BotaoSair } from '@/components/BotaoSair';
import { requireUser } from '@/lib/auth/dal';
import pool from '@/lib/db';
import { atribuicaoFfb } from '@/lib/especies-ffb';
import { visibleNavItems } from '@/lib/auth/menu';
import { logout } from '../actions';

/** No celular, o que não cabe no rodapé: configurações, administração, conta e sair. */
export default async function MaisPage() {
  const user = await requireUser();
  const items = visibleNavItems(user.perfil).filter((item) => item.placement === 'more');
  const atribuicao = await atribuicaoFfb(pool);

  return (
    <main>
      <PageHeader area={user.nomeExibicao} title="Mais" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-touch items-center rounded-xl border border-line bg-white px-5 text-lg font-semibold text-ink active:bg-brand-light"
          >
            {item.label}
          </Link>
        ))}
        <BotaoSair logoutAction={logout} />
        {/* Licença CC-BY 4.0 da lista de nomes usada no cadastro de espécie (RF-68) */}
        {atribuicao && <p className="pt-4 text-xs text-muted">{atribuicao}</p>}
      </div>
    </main>
  );
}
