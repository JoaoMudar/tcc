import { AreaPlaceholder } from '@/components/AreaPlaceholder';
import { requirePageAccess } from '@/lib/auth/guards';

export default async function ProducaoPage() {
  await requirePageAccess('agenda');
  return <AreaPlaceholder area="2 · Produção" title="Produção" />;
}
