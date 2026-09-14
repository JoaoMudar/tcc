import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Notice } from '@/components/ui/Notice';
import pool from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { PARAMETRO_INFO, listParametros, parametroLabel } from '@/lib/parametros';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';
import { ParametrosForm } from './ParametrosForm';

/** F1 UC-06: parâmetros do sistema (RF-09). Só se altera o valor: não há criar nem excluir. */
export default async function ParametrosPage() {
  const user = await requirePageAccess('parametros');
  const parametros = await listParametros(pool);
  const podeEditar = can(user.perfil, 'parametros', 'A');

  return (
    <main>
      <PageHeader area="Configurações" title="Parâmetros do sistema" />
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 md:p-8">
        <Link href="/configuracoes" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <Notice tone="info">
          Estes valores mudam o que as telas mostram. Não é possível criar nem excluir parâmetro.
          {!podeEditar && ' Seu perfil pode consultar, mas não alterar.'}
        </Notice>
        <ParametrosForm
          podeEditar={podeEditar}
          parametros={parametros.map((parametro) => ({
            chave: parametro.chave,
            valor: parametro.valor,
            tipoValor: parametro.tipoValor,
            label: parametroLabel(parametro),
            unidade: PARAMETRO_INFO[parametro.chave]?.unidade ?? '',
            dica: PARAMETRO_INFO[parametro.chave]?.dica ?? '',
            alteracao: parametro.atualizadoPorNome
              ? `Alterado por ${parametro.atualizadoPorNome} em ${formatDateTime(parametro.atualizadoEm)}`
              : '',
          }))}
        />
      </div>
    </main>
  );
}
