import type { ReactNode } from 'react';
import { formatQuantidade } from '@/lib/lotes-rotulos';
import { type EstadoDaResposta, formatAltura } from '@/lib/pedidos-rotulos';

/** Branco é o que ainda não foi olhado, e é o que a pessoa procura na tela. */
export const COR_DO_ESTADO: Record<EstadoDaResposta, string> = {
  pendente: 'border-line bg-white',
  tudo: 'border-green-600 bg-green-50',
  parte: 'border-amber-500 bg-amber-50',
  nao_tem: 'border-red-600 bg-red-50',
};

const COR_DO_RESUMO: Record<Exclude<EstadoDaResposta, 'pendente'>, string> = {
  tudo: 'text-green-800',
  parte: 'text-amber-900',
  nao_tem: 'text-red-800',
};

interface CabecalhoItemProps {
  /** "Genérico" em cima do título, no item sem espécie. */
  sobretitulo?: string;
  titulo: string;
  quantidade: number | null;
  recipiente: string | null;
  alturaM: number | null;
  estado: EstadoDaResposta;
  /** O que a gerência respondeu, numa linha. Vazio enquanto pendente. */
  resumo?: string;
  children?: ReactNode;
}

/**
 * P12: o topo do cartão, igual no específico e no genérico. **O pedido vem em
 * três etiquetas**, uma por atributo, e o que o cliente não disse aparece como
 * "a definir": é o que diz à pessoa, de relance, o que os botões vão perguntar.
 */
export function CabecalhoItem({
  sobretitulo,
  titulo,
  quantidade,
  recipiente,
  alturaM,
  estado,
  resumo,
  children,
}: CabecalhoItemProps) {
  const etiquetas = [
    quantidade === null ? 'quantidade a definir' : `${formatQuantidade(quantidade)} mudas`,
    recipiente ?? 'recipiente a definir',
    ...(alturaM === null ? [] : [formatAltura(alturaM)]),
  ];

  return (
    <div className="flex flex-col gap-2">
      {sobretitulo && <p className="text-sm font-bold tracking-widest text-muted uppercase">{sobretitulo}</p>}
      <p className="text-lg leading-tight font-bold text-ink">{titulo}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="O que o cliente pediu">
        {etiquetas.map((texto) => (
          <li
            key={texto}
            className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
              texto.includes('a definir') ? 'bg-gray-100 text-muted' : 'bg-white text-ink ring-1 ring-line'
            }`}
          >
            {texto}
          </li>
        ))}
      </ul>
      {children}
      {estado !== 'pendente' && resumo && (
        <p className={`text-base font-bold ${COR_DO_RESUMO[estado]}`} aria-live="polite">
          {resumo}
        </p>
      )}
    </div>
  );
}
