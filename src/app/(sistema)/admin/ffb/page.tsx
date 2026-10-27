import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { atribuicaoFfb } from '@/lib/especies-ffb';
import { versaoFfbAtual } from '@/lib/ffb/importar';
import { requirePageAccess } from '@/lib/auth/guards';
import { Reconferir } from './Reconferir';

/**
 * RF-13, RN-04: a cópia da Flora e Funga do Brasil em uso, e a reconferência das
 * espécies cadastradas contra ela. A importação da versão nova é do script de
 * manutenção: o arquivo da lista passa do limite de envio da hospedagem.
 */
export default async function FfbPage() {
  await requirePageAccess('referencia_ffb');
  const [versao, atribuicao, contagem] = await Promise.all([
    versaoFfbAtual(pool),
    atribuicaoFfb(pool),
    pool.query<{ validadas: number; pendentes: number }>(
      `SELECT COUNT(*) FILTER (WHERE status_validacao = 'validado')::int AS validadas,
              COUNT(*) FILTER (WHERE status_validacao = 'pendente')::int AS pendentes
         FROM especies WHERE ativa`,
    ),
  ]);
  const { validadas, pendentes } = contagem.rows[0];

  return (
    <main>
      <PageHeader area="Administração" title="Flora e Funga do Brasil" />
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8">
        {versao ? (
          <section className="flex flex-col gap-1 rounded-xl border border-line bg-white p-4">
            <p className="text-base font-semibold text-ink">Versão {versao.versao} em uso</p>
            {versao.publicadaEm && <p className="text-sm text-muted">Publicada em {versao.publicadaEm}.</p>}
            <p className="text-sm text-muted">
              {validadas} espécie(s) conferidas, {pendentes} pendente(s) de revisão pela chefia.
            </p>
          </section>
        ) : (
          <Notice tone="warning">Nenhuma cópia da Flora e Funga foi importada ainda.</Notice>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold tracking-widest text-muted uppercase">Versão nova</h2>
          <p className="text-base text-ink">
            A importação roda no computador de manutenção, com <code>npm run db:ffb -- --gravar</code>, e já reconfere as
            espécies na mesma vez. Para reconferir de novo contra a versão em uso, use o botão.
          </p>
          <Reconferir />
        </section>

        {atribuicao && <p className="text-sm text-muted">{atribuicao}</p>}
      </div>
    </main>
  );
}
