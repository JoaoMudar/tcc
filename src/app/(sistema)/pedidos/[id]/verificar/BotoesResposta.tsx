import { Button } from '@/components/ui/Button';
import type { PerguntasDoItem } from '@/lib/pedidos-rotulos';

export type Resposta = 'nao_tem' | 'parte' | 'tudo';

interface BotoesRespostaProps {
  perguntas: PerguntasDoItem;
  /** A resposta gravada ou aberta agora: o botão dela fica cheio. */
  selecionada: Resposta | null;
  pending: boolean;
  onEscolher: (resposta: Resposta) => void;
}

/**
 * P12: os botões vêm da regra (`perguntasDoItem`), e não de cada tela. Três
 * quando o cliente especificou alguma coisa, dois ("Não tem" e "Tem") quando
 * não especificou nada: não há "parte" de um pedido que não diz nada.
 *
 * Largos e da mesma altura, porque quem confere está com o celular numa mão.
 */
export function BotoesResposta({ perguntas, selecionada, pending, onEscolher }: BotoesRespostaProps) {
  const variante = (resposta: Resposta) => (selecionada === resposta ? 'primary' : 'outline');

  return (
    <div className={`grid gap-2 ${perguntas.temParte ? 'grid-cols-3' : 'grid-cols-2'}`}>
      <Button type="button" variant={variante('nao_tem')} disabled={pending} onClick={() => onEscolher('nao_tem')}>
        Não tem
      </Button>
      {perguntas.temParte && (
        <Button type="button" variant={variante('parte')} disabled={pending} onClick={() => onEscolher('parte')}>
          Tem parte
        </Button>
      )}
      <Button type="button" variant={variante('tudo')} disabled={pending} onClick={() => onEscolher('tudo')}>
        {perguntas.rotuloTudo}
      </Button>
    </div>
  );
}
