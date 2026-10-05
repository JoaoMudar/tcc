'use client';

import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Modal } from '@/components/ui/Modal';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { lerQuantidade } from '@/lib/lotes-rotulos';
import { chaveSaldo, mascaraAltura, parseAltura, saldoDoItem } from '@/lib/pedidos-rotulos';
import { type Linha, type SaldosPorChave, textoSaldo } from './linhas-pedido';

interface ItemEmFocoProps {
  linha: Linha;
  indice: number;
  opcoesEspecie: readonly SelectOption[];
  recipientes: readonly SelectOption[];
  saldos: SaldosPorChave;
  onAlterar: (chave: number, campo: keyof Omit<Linha, 'chave'>, valor: string | boolean) => void;
  onRemover: (chave: number) => void;
  onFechar: () => void;
  /** O nome digitado que não está no catálogo, para cadastrar e voltar escolhido aqui. */
  onCriarEspecie: (chave: number, nome: string) => void;
}

/**
 * T8.1, RNF-03: o item do pedido em tela cheia, que é como ele se edita no
 * celular. Um campo por vez, com o rótulo em cima, porque é aqui que a pessoa
 * está de fato digitando, e não na lista.
 *
 * Escreve no mesmo estado da planilha, então fechar não é cancelar: o que foi
 * digitado já está no pedido. No cadastro o pedido é gravado no botão do
 * formulário; na ficha, ao digitar.
 */
export function ItemEmFoco({
  linha,
  indice,
  opcoesEspecie,
  recipientes,
  saldos,
  onAlterar,
  onRemover,
  onFechar,
  onCriarEspecie,
}: ItemEmFocoProps) {
  const altura = parseAltura(linha.altura);
  const saldo = saldoDoItem(saldos[chaveSaldo(linha.especieId, linha.recipienteId)], 'error' in altura ? null : altura.value);
  const quantidade = lerQuantidade(linha.quantidade);
  const falta = linha.especieId && linha.recipienteId && quantidade !== null && quantidade > saldo.disponivel;

  return (
    <Modal titulo={`Item ${indice + 1}`} onFechar={onFechar}>
      <ComboboxField
        label="Espécie"
        options={opcoesEspecie}
        value={linha.especieId}
        onChange={(valor) => {
          // Escolher ou digitar outra espécie desfaz o genérico
          if (linha.generico) onAlterar(linha.chave, 'generico', false);
          onAlterar(linha.chave, 'especieId', valor);
        }}
        onCriarNova={(nome) => onCriarEspecie(linha.chave, nome)}
        rotuloCriar={(nome) => `+ Cadastrar "${nome}" como espécie nova`}
        // O genérico é a primeira opção, e escolhido fica no campo como qualquer espécie
        opcaoFixa={{
          rotulo: 'Genérico',
          ativa: linha.generico,
          onEscolher: () => {
            onAlterar(linha.chave, 'especieId', '');
            onAlterar(linha.chave, 'generico', true);
          },
        }}
        required
      />
      {/* O genérico pode levar uma observação: é o texto que a gerência lê para montar o item */}
      {linha.generico && (
        <TextField
          label="Observação"
          autoComplete="off"
          value={linha.especificacao}
          onChange={(evento) => onAlterar(linha.chave, 'especificacao', evento.target.value)}
        />
      )}

      <ComboboxField
        label="Recipiente"
        options={recipientes}
        value={linha.recipienteId}
        onChange={(valor) => onAlterar(linha.chave, 'recipienteId', valor)}
      />
      <TextField
        label="Altura em metros"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0,00 m"
        value={linha.altura}
        onChange={(evento) => onAlterar(linha.chave, 'altura', mascaraAltura(evento.target.value, linha.altura))}
      />
      <TextField
        label="Quantidade"
        inputMode="numeric"
        autoComplete="off"
        value={linha.quantidade}
        onChange={(evento) => onAlterar(linha.chave, 'quantidade', evento.target.value)}
      />

      {linha.especieId && linha.recipienteId && (
        <p className={`text-sm ${falta ? 'text-amber-800' : 'text-muted'}`}>
          {textoSaldo(saldo, quantidade)}
        </p>
      )}

      <Button onClick={onFechar}>Pronto</Button>
      <Button variant="secondary" onClick={() => onRemover(linha.chave)}>
        Tirar este item
      </Button>
    </Modal>
  );
}
