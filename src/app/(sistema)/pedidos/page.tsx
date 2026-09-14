import { AreaPlaceholder } from '@/components/AreaPlaceholder';
import { requirePageAccess } from '@/lib/auth/guards';

export default async function PedidosPage() {
  // TA-03: a gerência que digita este endereço cai em /sem-permissao
  await requirePageAccess('pedidos');
  return <AreaPlaceholder area="3 · Comercial" title="Pedidos" />;
}
