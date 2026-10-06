'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { Notice } from '@/components/ui/Notice';
import { Pill } from '@/components/ui/Pill';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { decimalParaCampo, mascaraDecimal3 } from '@/lib/recipientes';
import { updateRecipiente } from './actions';

interface RecipienteFormProps {
  recipiente: { id: string; nome: string; volumeLitros: number | null; pesoKg: number | null; ativo: boolean };
  podeEditar: boolean;
}

interface Valores {
  nome: string;
  volume: string;
  peso: string;
  ativo: boolean;
}

/** Quanto esperar depois da última tecla para gravar. */
export const ESPERA_PARA_GRAVAR_MS = 800;

/**
 * F1 UC-08: o recipiente **grava sozinho**, sem botão: um tempo depois da última
 * tecla, ao sair do campo e ao marcar "Em uso". Nome curto demais não grava, e
 * o aviso fica no cartão até a pessoa corrigir.
 */
export function RecipienteForm({ recipiente, podeEditar }: RecipienteFormProps) {
  const [state, formAction, pending] = useActionState(updateRecipiente, EMPTY_FORM_STATE);
  const [valores, setValores] = useState<Valores>(() => ({
    nome: recipiente.nome,
    volume: decimalParaCampo(recipiente.volumeLitros),
    peso: decimalParaCampo(recipiente.pesoKg),
    ativo: recipiente.ativo,
  }));
  const [aviso, setAviso] = useState<string | null>(null);
  // O que já está no banco: sair do campo sem mudar nada não regrava
  const gravado = useRef(JSON.stringify(valores));
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  function gravar(proximos: Valores) {
    if (espera.current) clearTimeout(espera.current);
    espera.current = null;
    if (proximos.nome.trim().length < 2) {
      setAviso('O nome do recipiente precisa ter de 2 a 60 caracteres.');
      return;
    }
    setAviso(null);
    const chave = JSON.stringify(proximos);
    // Repetir só vale se o banco já tem exatamente isto: depois de erro, vai de novo
    if (chave === gravado.current && !state.error) return;
    gravado.current = chave;

    const dados = new FormData();
    dados.set('recipiente_id', recipiente.id);
    dados.set('nome', proximos.nome);
    dados.set('volume', proximos.volume);
    dados.set('peso', proximos.peso);
    if (proximos.ativo) dados.set('ativo', 'on');
    startTransition(() => formAction(dados));
  }

  function alterar(campo: 'nome' | 'volume' | 'peso', texto: string) {
    const valor = campo === 'nome' ? texto : mascaraDecimal3(texto, valores[campo]);
    const proximos = { ...valores, [campo]: valor };
    setValores(proximos);
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => gravar(proximos), ESPERA_PARA_GRAVAR_MS);
  }

  const erro = aviso ?? state.error;
  const situacao = pending ? 'Salvando…' : state.success && !erro ? 'Salvo' : '';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
      {!recipiente.ativo && (
        <span>
          <Pill tone="neutral">fora de uso</Pill>
        </span>
      )}
      <fieldset disabled={!podeEditar} className="flex flex-col gap-3">
        <TextField
          label="Nome"
          name="nome"
          value={valores.nome}
          required
          onChange={(evento) => alterar('nome', evento.target.value)}
          onBlur={() => gravar(valores)}
        />
        <div className="grid grid-cols-3 items-end gap-3">
          <TextField
            label="Volume (L)"
            name="volume"
            inputMode="numeric"
            autoComplete="off"
            value={valores.volume}
            onChange={(evento) => alterar('volume', evento.target.value)}
            onBlur={() => gravar(valores)}
          />
          <TextField
            label="Peso cheio (kg)"
            name="peso"
            inputMode="numeric"
            autoComplete="off"
            value={valores.peso}
            onChange={(evento) => alterar('peso', evento.target.value)}
            onBlur={() => gravar(valores)}
          />
          <label className="flex min-h-touch items-center gap-2 text-base font-semibold text-gray-700">
            <input
              type="checkbox"
              name="ativo"
              checked={valores.ativo}
              onChange={(evento) => {
                const proximos = { ...valores, ativo: evento.target.checked };
                setValores(proximos);
                gravar(proximos);
              }}
              className="size-6 accent-brand"
            />
            Em uso
          </label>
        </div>
      </fieldset>
      {podeEditar && (
        <>
          {erro && <Notice tone="error">{erro}</Notice>}
          <p className="text-sm text-muted empty:hidden" aria-live="polite">
            {situacao}
          </p>
        </>
      )}
    </div>
  );
}
