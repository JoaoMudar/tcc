import { AreaPlaceholder } from '@/components/AreaPlaceholder';
import { requirePageAccess } from '@/lib/auth/guards';

export default async function ConfiguracoesPage() {
  await requirePageAccess('parametros');
  return <AreaPlaceholder area="Configurações" title="Configurações" />;
}
