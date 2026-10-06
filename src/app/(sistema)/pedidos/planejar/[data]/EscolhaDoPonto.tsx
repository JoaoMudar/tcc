'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CampoEndereco } from '@/components/ui/CampoEndereco';
import { Notice } from '@/components/ui/Notice';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { buscarEnderecosAction, definirPartidaAction } from './actions';

export type EscolhaDePartida = 'agrolandia' | 'itapema' | 'outro';

const PARTIDAS: { escolha: EscolhaDePartida; nome: string }[] = [
  { escolha: 'agrolandia', nome: 'Agrolândia' },
  { escolha: 'itapema', nome: 'Itapema' },
  { escolha: 'outro', nome: 'Outro' },
];

interface EscolhaDoPontoProps {
  /** A saída ou a volta: as duas se escolhem do mesmo jeito. */
  ponta: 'saida' | 'volta';
  data: string;
  viagemId: string;
  ponto: { descricao: string; escolha: EscolhaDePartida };
}

/** Tela 2: Agrolândia, Itapema ou um endereço digitado. Tocar grava na hora. */
export function EscolhaDoPonto({ ponta, data, viagemId, ponto }: EscolhaDoPontoProps) {
  const [outro, setOutro] = useState(ponto.escolha === 'outro');
  const [estado, escolher, escolhendo] = useActionState(definirPartidaAction, EMPTY_FORM_STATE);
  const titulo = ponta === 'saida' ? 'Saída' : 'Volta';

  const ocultos = (
    <>
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="viagem_id" value={viagemId} />
      <input type="hidden" name="ponta" value={ponta} />
    </>
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold tracking-widest text-muted uppercase">{titulo}</h2>
      {estado.error && <Notice tone="error">{estado.error}</Notice>}
      <div role="group" aria-label={titulo} className="grid grid-cols-3 gap-1.5">
        {PARTIDAS.map(({ escolha, nome }) => {
          const ativa = outro ? escolha === 'outro' : ponto.escolha === escolha;
          const estilo = `min-h-11 w-full rounded-lg border text-base font-bold ${ativa ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white text-ink'}`;
          return escolha === 'outro' ? (
            <button key={escolha} type="button" aria-pressed={ativa} className={estilo} onClick={() => setOutro(true)}>
              {nome}
            </button>
          ) : (
            <form key={escolha} action={escolher} onSubmit={() => setOutro(false)}>
              {ocultos}
              <input type="hidden" name="partida" value={escolha} />
              <button type="submit" aria-pressed={ativa} disabled={escolhendo} className={estilo}>
                {nome}
              </button>
            </form>
          );
        })}
      </div>
      {outro && (
        <form action={escolher} className="flex items-end gap-2">
          {ocultos}
          <input type="hidden" name="partida" value="outro" />
          <CampoEndereco
            label={ponta === 'saida' ? 'Endereço de saída' : 'Endereço de volta'}
            name="endereco"
            className="flex-1"
            required
            defaultValue={estado.fields?.endereco ?? (ponto.escolha === 'outro' ? ponto.descricao : '')}
            buscar={buscarEnderecosAction}
          />
          <Button type="submit" className="w-auto!" pending={escolhendo} pendingLabel="…">
            Usar
          </Button>
        </form>
      )}
    </section>
  );
}
