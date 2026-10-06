'use client';

import { useState } from 'react';
import { Notice } from '@/components/ui/Notice';
import type { SelectOption } from '@/components/ui/SelectField';
import { buscarNomesEspecieAction } from './actions';
import { BuscaNomeEspecie, type EscolhaFlora } from './BuscaNomeEspecie';
import { EspecieForm } from './EspecieForm';

/** A busca preenche o formulário; o formulário continua aceitando o nome digitado à mão. */
export function NovaEspecie({ caracteristicas }: { caracteristicas: readonly SelectOption[] }) {
  const [escolha, setEscolha] = useState<EscolhaFlora | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <BuscaNomeEspecie buscar={buscarNomesEspecieAction} onEscolher={setEscolha} />
      {escolha?.nomeAntigo && (
        <Notice tone="info">
          Esse nome mudou. Hoje se chama <i>{escolha.nomeCientifico}</i>.
        </Notice>
      )}
      {escolha?.familia && <p className="text-sm text-muted">Família {escolha.familia}</p>}
      {/* A chave recria o formulário com o que foi escolhido */}
      <EspecieForm
        key={escolha?.taxonId ?? 'livre'}
        caracteristicas={caracteristicas}
        podeEditar
        sugestao={
          escolha
            ? {
                nomeCientifico: escolha.nomeCientifico,
                nomesPopulares: escolha.nomePopular ? [primeiraMaiuscula(escolha.nomePopular)] : [],
                taxonIdFfb: escolha.taxonId,
                sinonimoTaxonIdFfb: escolha.nomeAntigo?.taxonId ?? null,
              }
            : undefined
        }
      />
    </div>
  );
}

/** A FFB escreve "aroeira"; o catálogo do viveiro, "Aroeira". */
function primeiraMaiuscula(nome: string): string {
  return nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1);
}
