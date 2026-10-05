import { redirect } from 'next/navigation';
import { hojeNoViveiro } from '@/lib/datas';
import { lerSemana } from '@/lib/semanas';

interface AgendaSemanaPageProps {
  searchParams: Promise<{ semana?: string; feito?: string }>;
}

/**
 * A semana deixou de ser outra tela: mora em /producao, abaixo do dia. O endereço
 * antigo continua valendo e leva à segunda-feira pedida.
 */
export default async function AgendaSemanaPage({ searchParams }: AgendaSemanaPageProps) {
  const { semana, feito } = await searchParams;
  const hoje = hojeNoViveiro();
  // Sem semana na URL, o dia de cima é hoje, e não a segunda desta semana
  const dia = semana ? lerSemana(semana, hoje) : hoje;
  redirect(`/producao?dia=${dia}${feito ? `&feito=${encodeURIComponent(feito)}` : ''}`);
}
