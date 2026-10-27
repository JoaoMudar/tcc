import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import pool from '@/lib/db';
import { CARACTERISTICA_LABELS } from '@/lib/especies';
import { atribuicaoFfb } from '@/lib/especies-ffb';
import { requirePageAccess } from '@/lib/auth/guards';
import { NovaEspecie } from '../NovaEspecie';

export default async function NovaEspeciePage() {
  await requirePageAccess('especies', 'C');
  const caracteristicas = Object.entries(CARACTERISTICA_LABELS).map(([value, label]) => ({ value, label }));
  // RNF-18: a busca mostra nomes da Flora e Funga, e a licença CC-BY pede a atribuição onde eles aparecem
  const atribuicao = await atribuicaoFfb(pool);

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Nova espécie" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/cadastros/especies" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <NovaEspecie caracteristicas={caracteristicas} />
        {atribuicao && <p className="pt-2 text-xs text-muted">{atribuicao}</p>}
      </div>
    </main>
  );
}
