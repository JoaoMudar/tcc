'use client';

import { type ChangeEvent, useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import type { SelectOption } from '@/components/ui/SelectField';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { EMPTY_FORM_STATE } from '@/lib/form-state';
import { reduzFoto } from '@/lib/reduz-foto';
import { saveEspecieAction } from './actions';

interface EspecieFormProps {
  especie?: {
    id: string;
    nomeCientifico: string;
    nomesPopulares: string[];
    caracteristicas: string[];
    observacoes: string | null;
    fotoUrl: string | null;
    ativa: boolean;
  };
  caracteristicas: readonly SelectOption[];
  podeEditar: boolean;
}

export function EspecieForm({ especie, caracteristicas, podeEditar }: EspecieFormProps) {
  const [state, formAction, pending] = useActionState(saveEspecieAction, EMPTY_FORM_STATE);
  const [foto, setFoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [fotoErro, setFotoErro] = useState<string | null>(null);
  // Na recusa, o formulário mantém o que foi digitado
  const fields = state.error ? state.fields : undefined;
  const marcadas = fields ? fields.caracteristicas.split(',') : (especie?.caracteristicas ?? []);

  useEffect(() => () => {
    if (foto) URL.revokeObjectURL(foto.preview);
  }, [foto]);

  async function escolherFoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPreparando(true);
    setFotoErro(null);
    try {
      const blob = await reduzFoto(file);
      setFoto({ blob, preview: URL.createObjectURL(blob) });
    } catch {
      setFotoErro('Não foi possível ler essa foto. Tente outra.');
    } finally {
      setPreparando(false);
      input.value = '';
    }
  }

  // O arquivo original não vai para o servidor: só a versão reduzida
  function enviar(formData: FormData) {
    if (foto) formData.set('foto', foto.blob, foto.blob.type === 'image/webp' ? 'foto.webp' : 'foto.jpg');
    formAction(formData);
  }

  const fotoExibida = foto?.preview ?? especie?.fotoUrl;

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <fieldset disabled={!podeEditar} className="flex flex-col gap-4">
        {especie && <input type="hidden" name="especie_id" value={especie.id} />}

        <div className="flex items-center gap-4">
          {fotoExibida ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoExibida} alt="Foto da espécie" className="size-24 flex-none rounded-xl object-cover" />
          ) : (
            <span className="flex size-24 flex-none items-center justify-center rounded-xl bg-gray-100 text-sm text-muted">
              sem foto
            </span>
          )}
          {podeEditar && (
            <label className="inline-flex min-h-touch cursor-pointer items-center justify-center rounded-xl border-2 border-brand bg-white px-4 text-base font-bold text-brand active:bg-brand-light">
              {fotoExibida ? 'Trocar foto' : 'Adicionar foto'}
              <input type="file" accept="image/*" className="sr-only" onChange={escolherFoto} />
            </label>
          )}
        </div>
        {preparando && <p className="text-base text-muted">Preparando a foto…</p>}
        {fotoErro && <Notice tone="error">{fotoErro}</Notice>}
        {podeEditar && especie?.fotoUrl && !foto && (
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="remover_foto" className="size-6 accent-brand" />
            Remover a foto
          </label>
        )}

        <TextField
          label="Nome científico"
          name="nome_cientifico"
          defaultValue={fields?.nome_cientifico ?? especie?.nomeCientifico}
          autoCapitalize="sentences"
          required
        />
        <TextArea
          label="Nomes populares"
          name="nomes_populares"
          hint="Um por linha. O primeiro é o nome principal."
          defaultValue={fields?.nomes_populares ?? especie?.nomesPopulares.join('\n')}
        />

        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-semibold text-gray-700">Características</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {caracteristicas.map((c) => (
              <label key={c.value} className="flex min-h-touch items-center gap-3 text-base text-gray-700">
                <input
                  type="checkbox"
                  name="caracteristicas"
                  value={c.value}
                  defaultChecked={marcadas.includes(c.value)}
                  className="size-6 accent-brand"
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        <TextArea label="Observações" name="observacoes" defaultValue={fields?.observacoes ?? especie?.observacoes ?? ''} />

        {especie && podeEditar && (
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativa" defaultChecked={especie.ativa} className="size-6 accent-brand" />
            Em uso (aparece na criação de lote e no pedido)
          </label>
        )}
      </fieldset>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      {podeEditar && (
        <Button type="submit" pending={pending || preparando} pendingLabel={preparando ? 'Preparando a foto…' : 'Salvando…'}>
          Salvar
        </Button>
      )}
    </form>
  );
}
