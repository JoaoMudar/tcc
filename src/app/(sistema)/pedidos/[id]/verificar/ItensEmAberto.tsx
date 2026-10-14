'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface ItensEmAbertoContexto {
  abertos: number;
  marcar: (itemId: string, emAberto: boolean) => void;
}

/** Fora do provedor (os testes de um cartão só), nada conta e nada se marca. */
const Contexto = createContext<ItensEmAbertoContexto>({ abertos: 0, marcar: () => undefined });

/**
 * Os itens da conferência que estão **em aberto na tela**: resposta tocada que
 * ainda não chegou ao banco, ou painel com campo obrigatório faltando. O rodapé
 * só sabe o que o banco tem, e "Tem" sem o recipiente não grava nada: sem esta
 * conta, ele oferecia "Enviar" com o item ainda gravado como "Não tem".
 */
export function ItensEmAberto({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const marcar = useCallback((itemId: string, emAberto: boolean) => {
    setIds((atuais) => {
      if (atuais.has(itemId) === emAberto) return atuais;
      const proximos = new Set(atuais);
      if (emAberto) proximos.add(itemId);
      else proximos.delete(itemId);
      return proximos;
    });
  }, []);
  const valor = useMemo(() => ({ abertos: ids.size, marcar }), [ids, marcar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** O cartão diz se está em aberto; ao sair da tela, deixa de contar. */
export function useItemEmAberto(itemId: string, emAberto: boolean): void {
  const { marcar } = useContext(Contexto);
  useEffect(() => {
    marcar(itemId, emAberto);
  }, [marcar, itemId, emAberto]);
  useEffect(() => () => marcar(itemId, false), [marcar, itemId]);
}

/** Quantos itens estão em aberto na tela. */
export function useItensEmAberto(): number {
  return useContext(Contexto).abertos;
}
