import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { type Recurso, can } from '@/lib/permissions';
import { requirePageAccess } from '@/lib/auth/guards';

const SECOES: readonly { href: string; title: string; description: string; recurso: Recurso }[] = [
  {
    href: '/cadastros/especies',
    title: 'Espécies',
    description: 'Nome científico, nomes populares, características e foto.',
    recurso: 'especies',
  },
  { href: '/cadastros/recipientes', title: 'Recipientes', description: 'Tubete, sacos e balde: o tamanho da muda.', recurso: 'recipientes' },
  { href: '/cadastros/insumos', title: 'Insumos', description: 'Substrato, adubo e defensivo, com a unidade de medida.', recurso: 'insumos' },
  { href: '/cadastros/pessoas', title: 'Pessoas', description: 'Clientes, fornecedores e funcionários num cadastro só.', recurso: 'pessoas' },
  {
    href: '/cadastros/areas',
    title: 'Áreas e canteiros',
    description: 'Onde a muda fica: área por letra, canteiro por número.',
    recurso: 'areas_canteiros',
  },
  { href: '/cadastros/tipos-tarefa', title: 'Tipos de tarefa', description: 'O que cada tarefa pede na agenda.', recurso: 'tipos_tarefa' },
  {
    href: '/cadastros/protocolos',
    title: 'Protocolos de atividades',
    description: 'A receita de manejo de cada recipiente: as etapas e os prazos.',
    recurso: 'protocolos',
  },
];

/** 1 · Cadastro único: a chefia decide o que o viveiro faz, a gerência decide como faz (D4 §3.4). */
export default async function CadastrosPage() {
  const user = await requirePageAccess('especies');

  return (
    <main>
      <PageHeader area="1 · Cadastros" title="Cadastros" />
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
