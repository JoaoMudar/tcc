'use client';

import { Button } from '@/components/ui/Button';
import { ComboboxField } from '@/components/ui/ComboboxField';
import { Modal } from '@/components/ui/Modal';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { formatQuantidade, lerQuantidade } from '@/lib/lotes-rotulos';
import { chaveSaldo, normalizaCampoAltura } from '@/lib/pedidos-rotulos';
import type { Linha } from './linhas-pedido';
import type { SaldosPorChave } from './NovoPedidoForm';

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
 * digitado já está no pedido, e o pedido só é gravado no botão do formulário.
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
  const saldo = saldos[chaveSaldo(linha.especieId, linha.recipienteId)];
  const pronto = saldo?.pronto ?? 0;
  const quantidade = lerQuantidade(linha.quantidade);
  const falta = linha.especieId && linha.recipienteId && quantidade !== null && quantidade > pronto;

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
        inputMode="decimal"
        autoComplete="off"
        placeholder="1,20 ou 120"
        value={linha.altura}
        onChange={(evento) => onAlterar(linha.chave, 'altura', evento.target.value)}
        onBlur={(evento) => onAlterar(linha.chave, 'altura', normalizaCampoAltura(evento.target.value))}
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
          Pronto para venda: <strong>{formatQuantidade(pronto)}</strong>
          {saldo && saldo.producao > 0 && ` · ${formatQuantidade(saldo.producao)} em produção, ainda não pronta`}
          {falta && quantidade !== null && ` · faltam ${formatQuantidade(quantidade - pronto)}`}
        </p>
      )}

      <Button onClick={onFechar}>Pronto</Button>
      <Button variant="secondary" onClick={() => onRemover(linha.chave)}>
        Tirar este item
      </Button>
    </Modal>
  );
}
