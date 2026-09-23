'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { formatDocumento, formatTelefone, validateDocumento } from '@/lib/documento';
import {
  EMPTY_PESSOA_STATE,
  ENDERECO_FISCAL,
  ENDERECOS_COMUNS,
  PAPEIS,
  PAPEL_LABELS,
  type Papel,
  type PessoaFicha,
  type PessoaRef,
  TIPO_PESSOA_LABELS,
  type TipoPessoa,
  VINCULO_LABELS,
} from '@/lib/pessoas-form';
import { EnderecoFields } from './EnderecoFields';
import { savePessoaAction } from './actions';

interface PessoaFormProps {
  pessoa?: PessoaFicha;
  /** Mostra e envia documento e endereço de cobrança. A gerência não recebe nem o campo (D4 §3.1). */
  verFiscal: boolean;
  podeEditar: boolean;
  /**
   * Aberto de dentro do pedido (UC-31 FA-1): a pessoa entra como cliente, o
   * telefone passa a ser exigido, e salvar devolve o cliente em vez de ir para
   * a ficha, que tiraria quem cadastra do pedido pela metade.
   */
  paraPedido?: { onCriado: (cliente: PessoaRef) => void; onCancelar: () => void };
}

const VINCULO_OPTIONS = Object.entries(VINCULO_LABELS).map(([value, label]) => ({ value, label }));

export function PessoaForm({ pessoa, verFiscal, podeEditar, paraPedido }: PessoaFormProps) {
  const [state, formAction, pending] = useActionState(savePessoaAction, EMPTY_PESSOA_STATE);
  const avisado = useRef<string | null>(null);
  const onCriado = paraPedido?.onCriado;
  useEffect(() => {
    if (onCriado && state.cliente && avisado.current !== state.cliente.id) {
      avisado.current = state.cliente.id;
      onCriado(state.cliente);
    }
  }, [state.cliente, onCriado]);

  const fields = state.error || state.candidatas ? state.fields : undefined;
  const temPapel = (papel: Papel) =>
    fields ? fields[`papel_${papel}`] === 'on' : Boolean(pessoa?.papeis.some((p) => p.papel === papel));

  const [tipo, setTipo] = useState<TipoPessoa>(pessoa?.tipo ?? 'pf');
  const [funcionario, setFuncionario] = useState(temPapel('funcionario'));
  const [documentoErro, setDocumentoErro] = useState<string | null>(null);
  const vinculo = fields?.tipo_vinculo ?? pessoa?.papeis.find((p) => p.papel === 'funcionario')?.tipoVinculo ?? undefined;
  const endereco = (t: string) => pessoa?.enderecos.find((e) => e.tipo === t);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset disabled={!podeEditar} className="flex flex-col gap-4">
        {pessoa && <input type="hidden" name="pessoa_id" value={pessoa.id} />}
        {!pessoa && <input type="hidden" name="ativa" value="on" />}
        {paraPedido && (
          <>
            <input type="hidden" name="para_pedido" value="1" />
            <input type="hidden" name="papel_cliente" value="on" />
          </>
        )}

        <div role="radiogroup" aria-label="Tipo de pessoa" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
          {(Object.keys(TIPO_PESSOA_LABELS) as TipoPessoa[]).map((valor) => (
            <label
              key={valor}
              className="flex min-h-touch cursor-pointer items-center justify-center rounded-lg text-sm font-semibold text-gray-700 has-checked:bg-white has-checked:text-brand-dark has-checked:shadow-sm"
            >
              <input
                type="radio"
                name="tipo"
                value={valor}
                checked={tipo === valor}
                onChange={() => {
                  setTipo(valor);
                  setDocumentoErro(null);
                }}
                className="sr-only"
              />
              {TIPO_PESSOA_LABELS[valor]}
            </label>
          ))}
        </div>

        <TextField label="Nome" name="nome" defaultValue={fields?.nome ?? pessoa?.nome} required />
        <TextField
          label="Telefone"
          name="telefone"
          type="tel"
          inputMode="tel"
          defaultValue={fields?.telefone ?? formatTelefone(pessoa?.telefone ?? null)}
          hint={paraPedido ? 'Com DDD' : undefined}
          required={Boolean(paraPedido)}
        />
        <TextField label="E-mail" name="email" type="email" defaultValue={fields?.email ?? pessoa?.email ?? ''} />

        {/* No pedido o papel é um só, e vai escondido lá em cima */}
        {!paraPedido && (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-semibold text-gray-700">Papéis</legend>
          {PAPEIS.map((papel) => (
            <label key={papel} className="flex min-h-touch items-center gap-3 text-base text-gray-700">
              <input
                type="checkbox"
                name={`papel_${papel}`}
                defaultChecked={temPapel(papel)}
                onChange={papel === 'funcionario' ? (event) => setFuncionario(event.currentTarget.checked) : undefined}
                className="size-6 accent-brand"
              />
              {PAPEL_LABELS[papel]}
            </label>
          ))}
        </fieldset>
        )}
        {!paraPedido && funcionario && (
          <SelectField label="Vínculo do funcionário" name="tipo_vinculo" options={VINCULO_OPTIONS} defaultValue={vinculo} required />
        )}

        {ENDERECOS_COMUNS.map((t) => (
          <EnderecoFields key={t} tipo={t} endereco={endereco(t)} fields={fields} />
        ))}

        {verFiscal && (
          <section className="flex flex-col gap-3">
            <input type="hidden" name="inclui_fiscal" value="1" />
            <h2 className="mt-3 text-sm font-bold tracking-widest text-muted uppercase">Dados fiscais</h2>
            <TextField
              label={tipo === 'pf' ? 'CPF' : 'CNPJ'}
              name="documento"
              inputMode="numeric"
              defaultValue={fields?.documento ?? (pessoa?.documento ? formatDocumento(pessoa.documento) : '')}
              error={documentoErro ?? undefined}
              onBlur={(event) => {
                const result = validateDocumento(tipo, event.currentTarget.value);
                setDocumentoErro('error' in result ? result.error : null);
              }}
            />
            <EnderecoFields tipo={ENDERECO_FISCAL} endereco={endereco(ENDERECO_FISCAL)} fields={fields} />
          </section>
        )}

        <TextArea label="Observações" name="observacoes" defaultValue={fields?.observacoes ?? pessoa?.observacoes ?? ''} />

        {pessoa && podeEditar && (
          <label className="flex min-h-touch items-center gap-3 text-base font-semibold text-gray-700">
            <input type="checkbox" name="ativa" defaultChecked={pessoa.ativa} className="size-6 accent-brand" />
            Cadastro ativo
          </label>
        )}
      </fieldset>

      {state.error && (
        <Notice tone="error">
          {state.error}
          {state.existente && paraPedido && (
            <Button type="submit" name="usar_pessoa_id" value={state.existente.id} className="mt-2" pending={pending}>
              Usar {state.existente.nome}
            </Button>
          )}
          {state.existente && !paraPedido && (
            <>
              {' '}
              <Link href={`/cadastros/pessoas/${state.existente.id}`} className="font-bold underline">
                Abrir o cadastro
              </Link>
            </>
          )}
        </Notice>
      )}
      {state.candidatas && paraPedido && (
        <>
          <Notice tone="warning">Já existe cadastro com esse telefone. É a mesma pessoa?</Notice>
          {state.candidatas.map((candidata) => (
            <Button key={candidata.id} type="submit" name="usar_pessoa_id" value={candidata.id} pending={pending}>
              Sim, usar {candidata.nome}
            </Button>
          ))}
        </>
      )}
      {state.candidatas && !paraPedido && (
        <Notice tone="warning">
          <p>Já existe cadastro com esse telefone:</p>
          <ul className="my-1">
            {state.candidatas.map((candidata) => (
              <li key={candidata.id}>
                <Link href={`/cadastros/pessoas/${candidata.id}`} className="font-bold underline">
                  {candidata.nome}
                </Link>
              </li>
            ))}
          </ul>
          <p>Se for a mesma pessoa, abra o cadastro dela e marque o papel novo: assim não fica cadastro repetido.</p>
        </Notice>
      )}
      {state.success && <Notice tone="success">{state.success}</Notice>}
      {podeEditar &&
        (state.candidatas ? (
          <Button type="submit" name="confirmar_novo" value="1" variant="outline" pending={pending}>
            É outra pessoa: criar cadastro
          </Button>
        ) : (
          <Button type="submit" pending={pending}>
            {paraPedido ? 'Salvar e voltar ao pedido' : 'Salvar'}
          </Button>
        ))}
      {paraPedido && (
        <Button variant="secondary" onClick={paraPedido.onCancelar}>
          Cancelar
        </Button>
      )}
    </form>
  );
}
