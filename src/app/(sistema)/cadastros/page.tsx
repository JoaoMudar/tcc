import { AreaPlaceholder } from '@/components/AreaPlaceholder';
import { requirePageAccess } from '@/lib/auth/guards';

export default async function CadastrosPage() {
  await requirePageAccess('especies');
  return <AreaPlaceholder area="1 · Cadastros" title="Cadastros" />;
}
