import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { TextField } from '@/components/ui/TextField';
import pool from '@/lib/db';
import { formatDocumento, formatTelefone } from '@/lib/documento';
import { PAPEL_LABELS, type Papel, listPessoas } from '@/lib/pessoas';
import { can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';
import { ClienteRapidoButton } from './ClienteRapidoButton';

const FILTROS: readonly { papel: Papel | null; label: string }[] = [
  { papel: null, label: 'Todos' },
  { papel: 'cliente', label: 'Clientes' },
  { papel: 'funcionario', label: 'Funcionários' },
  { papel: 'fornecedor', label: 'Fornec.' },
];

function filtroHref(busca: string, papel: Papel | null): string {
  const query = new URLSearchParams();
  if (busca) query.set('busca', busca);
  if (papel) query.set('papel', papel);
  const texto = query.toString();
  return texto ? `/cadastros/pessoas?${texto}` : '/cadastros/pessoas';
}

/**
 * F1 UC-12 e UC-14: um campo só, que aceita nome, telefone ou documento (RF-18).
 * Para a gerência o documento não é buscado nem exibido (D4 §3.1).
 */
export default async function PessoasPage({ searchParams }: PageProps<'/cadastros/pessoas'>) {
  const user = await requirePageAccess('pessoas');
  const params = await searchParams;
  const busca = typeof params.busca === 'string' ? params.busca.slice(0, 80) : '';
  const papel = typeof params.papel === 'string' && params.papel in PAPEL_LABELS ? (params.papel as Papel) : null;
  const verFiscal = can(user.perfil, 'dados_fiscais', 'L');
  const pessoas = await listPessoas(pool, { busca, papel, verFiscal });
  const podeCriar = can(user.perfil, 'pessoas', 'C');

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Pessoas" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4 md:p-8">
        <Link href="/cadastros" className="text-base font-semibold text-brand-dark">
          Voltar
        </Link>
        <form className="flex items-end gap-2">
          {papel && <input type="hidden" name="papel" value={papel} />}
          <TextField
            label={verFiscal ? 'Buscar por nome, telefone ou documento' : 'Buscar por nome ou telefone'}
            name="busca"
            type="search"
            defaultValue={busca}
            className="flex-1"
          />
          <Button type="submit" variant="secondary" className="w-auto">
            Buscar
          </Button>
        </form>

        <nav aria-label="Filtrar por papel" className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1">
          {FILTROS.map((filtro) => (
            <Link
              key={filtro.label}
              href={filtroHref(busca, filtro.papel)}
              aria-current={filtro.papel === papel ? 'page' : undefined}
              className="flex min-h-touch items-center justify-center rounded-lg text-sm font-semibold text-gray-700 aria-[current=page]:bg-white aria-[current=page]:text-brand-dark aria-[current=page]:shadow-sm"
            >
              {filtro.label}
            </Link>
          ))}
        </nav>

        {pessoas.map((pessoa) => {
          const funcionario = pessoa.papeis.find((p) => p.papel === 'funcionario');
          const detalhes = [
            pessoa.telefone ? formatTelefone(pessoa.telefone) : 'sem telefone',
            verFiscal && pessoa.documento ? formatDocumento(pessoa.documento) : null,
            funcionario ? (pessoa.temAcesso ? 'acessa o sistema' : 'sem acesso') : null,
            pessoa.ativa ? null : 'inativa',
          ].filter(Boolean);
          return (
            <Link
              key={pessoa.id}
              href={`/cadastros/pessoas/${pessoa.id}`}
              className={`flex flex-col gap-1 rounded-xl border border-line bg-white p-4 active:bg-brand-light ${
                pessoa.ativa ? '' : 'opacity-60'
              }`}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">{pessoa.nome}</span>
                <span className="flex flex-wrap gap-1">
                  {pessoa.papeis.map((p) => (
                    <Pill key={p.papel} tone={p.papel === 'cliente' ? 'green' : p.papel === 'fornecedor' ? 'blue' : 'neutral'}>
                      {p.tipoVinculo ? `${PAPEL_LABELS[p.papel].toLowerCase()} ${p.tipoVinculo}` : PAPEL_LABELS[p.papel].toLowerCase()}
                    </Pill>
                  ))}
                </span>
              </span>
              <span className="text-sm text-muted">{detalhes.join(' · ')}</span>
            </Link>
          );
        })}
        {pessoas.length === 0 && <p className="text-base text-muted">Nenhuma pessoa encontrada.</p>}

        {podeCriar && (
          <div className="mt-2 flex flex-col gap-3">
            <Link
              href="/cadastros/pessoas/nova"
              className="inline-flex min-h-touch items-center justify-center rounded-xl bg-brand px-5 text-base font-bold text-white active:bg-brand-dark"
            >
              + Nova pessoa
            </Link>
            <ClienteRapidoButton />
          </div>
        )}
      </div>
    </main>
  );
}
