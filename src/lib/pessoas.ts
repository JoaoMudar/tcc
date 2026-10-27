import type { PoolClient } from 'pg';
import { onlyDigits, validateDocumento, validateTelefone } from './documento';
import {
  ENDERECO_FISCAL,
  ENDERECO_LABELS,
  ENDERECOS_COMUNS,
  type Endereco,
  PAPEIS,
  PAPEL_LABELS,
  type Papel,
  type PapelPessoa,
  type PessoaFicha,
  type PessoaResumo,
  type TipoEndereco,
  type TipoPessoa,
  type TipoVinculo,
  UFS,
  enderecoFieldName,
} from './pessoas-form';
import type { Coordenada } from './rotas-ors';
import { type Db, escapeLike, violatedConstraint } from './sql';

export * from './pessoas-form';

/**
 * Ponto único de escrita da pessoa (RF-17, RN-45): identidade, papéis e
 * endereços passam por aqui. Cliente, fornecedor e funcionário são papéis da
 * mesma linha, e quem já existe ganha o papel em vez de um segundo cadastro.
 *
 * Dado fiscal (D4 §3.1) é o documento e o endereço de cobrança. Função que lê
 * recebe `verFiscal`, e sem ele o SQL nem seleciona esses campos.
 */

export interface PessoaFields {
  tipo: TipoPessoa;
  nome: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativa: boolean;
  papeis: PapelPessoa[];
  /** Só os comuns: o de cobrança anda em `FiscalFields`. */
  enderecos: Endereco[];
}

export interface FiscalFields {
  documento: string | null;
  enderecoCobranca: Endereco | null;
  /** RF-19, leiaute da NF-e: só na PJ. */
  razaoSocial: string | null;
  /** Dígitos ou `ISENTO`; nulo é não contribuinte, ou ainda não informado. */
  inscricaoEstadual: string | null;
}

/**
 * RF-19: a inscrição estadual como a NF-e a aceita. Em branco é "não
 * contribuinte"; "isento" em qualquer caixa vira `ISENTO`; o resto, só dígitos.
 */
export function parseInscricaoEstadual(texto: string): { error: string } | { value: string | null } {
  const limpo = texto.trim();
  if (!limpo) return { value: null };
  if (/^isento$/i.test(limpo)) return { value: 'ISENTO' };
  const digitos = onlyDigits(limpo);
  if (digitos.length < 2 || digitos.length > 14 || /[a-z]/i.test(limpo)) {
    return { error: 'A inscrição estadual é só número, ou ISENTO. Em branco, o cliente não é contribuinte.' };
  }
  return { value: digitos };
}

type Get = (name: string) => string;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Endereço todo em branco é "sem endereço" (`null`). */
export function parseEndereco(tipo: TipoEndereco, get: Get): { error: string } | { value: Endereco | null } {
  const logradouro = get(enderecoFieldName(tipo, 'logradouro')).trim();
  const cidade = get(enderecoFieldName(tipo, 'cidade')).trim();
  const uf = get(enderecoFieldName(tipo, 'uf')).trim().toUpperCase();
  const cep = onlyDigits(get(enderecoFieldName(tipo, 'cep')));
  // RF-19: número, bairro e código IBGE só vêm no endereço de cobrança, que é o da nota
  const numero = get(enderecoFieldName(tipo, 'numero')).trim();
  const bairro = get(enderecoFieldName(tipo, 'bairro')).trim();
  const codigoIbge = onlyDigits(get(enderecoFieldName(tipo, 'codigo_ibge')));
  if (!logradouro && !cidade && !uf && !cep && !numero && !bairro && !codigoIbge) return { value: null };

  const label = ENDERECO_LABELS[tipo];
  if (logradouro.length > 200 || cidade.length > 80 || numero.length > 20 || bairro.length > 80) {
    return { error: `${label}: texto longo demais.` };
  }
  if (uf && !(UFS as readonly string[]).includes(uf)) return { error: `${label}: escolha a UF da lista.` };
  if (cep && cep.length !== 8) return { error: `${label}: o CEP tem 8 números.` };
  if (codigoIbge && codigoIbge.length !== 7) return { error: `${label}: o código IBGE do município tem 7 números.` };
  return {
    value: {
      tipo,
      logradouro: logradouro || null,
      cidade: cidade || null,
      uf: uf || null,
      cep: cep || null,
      ...(tipo === ENDERECO_FISCAL ? { numero: numero || null, bairro: bairro || null, codigoIbge: codigoIbge || null } : {}),
    },
  };
}

/** Identidade, papéis e endereços comuns, lidos do formulário (RF-17, RF-19, RF-22). */
export function parsePessoaFields(get: Get): { error: string } | { value: PessoaFields } {
  const tipo = get('tipo');
  if (tipo !== 'pf' && tipo !== 'pj') return { error: 'Escolha pessoa física ou jurídica.' };

  const nome = get('nome').trim().replace(/\s+/g, ' ');
  if (nome.length < 2 || nome.length > 120) return { error: 'O nome precisa ter de 2 a 120 caracteres.' };

  const telefone = validateTelefone(get('telefone'));
  if ('error' in telefone) return telefone;

  const email = get('email').trim().toLowerCase();
  if (email && (email.length > 120 || !EMAIL.test(email))) return { error: 'E-mail inválido.' };

  const observacoes = get('observacoes').trim();
  if (observacoes.length > 1000) return { error: 'As observações podem ter até 1000 caracteres.' };

  const papeis: PapelPessoa[] = [];
  for (const papel of PAPEIS) {
    if (get(`papel_${papel}`) !== 'on') continue;
    let tipoVinculo: TipoVinculo | null = null;
    if (papel === 'funcionario') {
      const vinculo = get('tipo_vinculo');
      if (vinculo !== 'fixo' && vinculo !== 'diarista') return { error: 'Escolha se o funcionário é fixo ou diarista.' };
      tipoVinculo = vinculo;
    }
    papeis.push({ papel, tipoVinculo });
  }
  if (papeis.length === 0) return { error: 'Marque ao menos um papel: cliente, fornecedor ou funcionário.' };

  const enderecos: Endereco[] = [];
  for (const tipoEndereco of ENDERECOS_COMUNS) {
    const endereco = parseEndereco(tipoEndereco, get);
    if ('error' in endereco) return endereco;
    if (endereco.value) enderecos.push(endereco.value);
  }

  return {
    value: {
      tipo,
      nome,
      telefone: telefone.value,
      email: email || null,
      observacoes: observacoes || null,
      // Checkbox desmarcado não vai no formulário: o de cadastro novo manda `ativa=on` escondido
      ativa: get('ativa') === 'on',
      papeis,
      enderecos,
    },
  };
}

/** Documento e endereço de cobrança (RF-19, RF-21). Só chamada depois do guard de `dados_fiscais`. */
export function parseFiscalFields(tipo: TipoPessoa, get: Get): { error: string } | { value: FiscalFields } {
  const documento = validateDocumento(tipo, get('documento'));
  if ('error' in documento) return documento;
  const cobranca = parseEndereco(ENDERECO_FISCAL, get);
  if ('error' in cobranca) return cobranca;
  const razao = tipo === 'pj' ? get('razao_social').trim().replace(/\s+/g, ' ') : '';
  if (razao.length > 150) return { error: 'A razão social pode ter até 150 caracteres.' };
  const inscricao = parseInscricaoEstadual(get('inscricao_estadual'));
  if ('error' in inscricao) return inscricao;
  return {
    value: {
      documento: documento.value,
      enderecoCobranca: cobranca.value,
      razaoSocial: razao || null,
      inscricaoEstadual: inscricao.value,
    },
  };
}

export function duplicateMessage(error: unknown): string | null {
  return violatedConstraint(error, '23505') === 'pessoas_documento_key' ? 'Já existe pessoa com esse documento.' : null;
}

export function papeisResumo(papeis: readonly PapelPessoa[]): string {
  return papeis.map((p) => (p.tipoVinculo ? `${PAPEL_LABELS[p.papel]} ${p.tipoVinculo}` : PAPEL_LABELS[p.papel])).join(', ');
}

const PAPEIS_AGREGADOS = `
  COALESCE((SELECT json_agg(json_build_object('papel', pp.papel, 'tipoVinculo', pp.tipo_vinculo) ORDER BY pp.papel)
              FROM cadastro.pessoas_papeis pp WHERE pp.pessoa_id = p.id AND pp.ativo), '[]') AS papeis,
  EXISTS (SELECT 1 FROM usuarios u WHERE u.pessoa_id = p.id AND u.ativo) AS "temAcesso"`;

/**
 * RF-18: um campo só, que acha por parte do nome, pelo telefone e, para quem
 * pode ver dado fiscal, pelo documento. Para a gerência o documento nem entra no
 * WHERE: buscar por CPF e ver quem aparece também seria ler o CPF.
 */
export async function listPessoas(
  db: Db,
  options: { busca?: string; papel?: Papel | null; verFiscal: boolean },
): Promise<PessoaResumo[]> {
  const termo = (options.busca ?? '').trim();
  const digitos = onlyDigits(termo);
  const numero = digitos.length >= 3 ? digitos : '';
  const colunaDocumento = options.verFiscal ? ', p.documento' : '';
  const buscaDocumento = options.verFiscal ? `OR ($3 <> '' AND p.documento LIKE '%' || $3 || '%')` : '';

  const { rows } = await db.query<PessoaResumo>(
    `SELECT p.id, p.tipo, p.nome, p.telefone, p.ativa${colunaDocumento}, ${PAPEIS_AGREGADOS}
       FROM cadastro.pessoas p
      WHERE ($1 = '' OR p.nome ILIKE '%' || $2 || '%' OR ($3 <> '' AND p.telefone LIKE '%' || $3 || '%') ${buscaDocumento})
        AND ($4::cadastro.tipo_papel IS NULL OR EXISTS (
              SELECT 1 FROM cadastro.pessoas_papeis x WHERE x.pessoa_id = p.id AND x.ativo AND x.papel = $4))
      ORDER BY p.ativa DESC, p.nome
      LIMIT 300`,
    [termo, escapeLike(termo), numero, options.papel ?? null],
  );
  return rows;
}

export async function findPessoa(db: Db, id: string, verFiscal: boolean): Promise<PessoaFicha | null> {
  const colunaDocumento = verFiscal
    ? ', p.documento, p.razao_social AS "razaoSocial", p.inscricao_estadual AS "inscricaoEstadual"'
    : '';
  const tiposEndereco = verFiscal ? [...ENDERECOS_COMUNS, ENDERECO_FISCAL] : [...ENDERECOS_COMUNS];
  const { rows } = await db.query<PessoaFicha>(
    `SELECT p.id, p.tipo, p.nome, p.telefone, p.email, p.observacoes, p.ativa${colunaDocumento}, ${PAPEIS_AGREGADOS},
            COALESCE((SELECT json_agg(json_build_object('tipo', e.tipo, 'logradouro', e.logradouro, 'cidade', e.cidade,
                                                        'uf', e.uf, 'cep', e.cep, 'numero', e.numero, 'bairro', e.bairro,
                                                        'codigoIbge', e.codigo_ibge,
                                                        'lat', e.lat::float8, 'lng', e.lng::float8) ORDER BY e.tipo, e.criado_em)
                        FROM cadastro.pessoas_enderecos e
                       WHERE e.pessoa_id = p.id AND e.tipo = ANY($2::cadastro.tipo_endereco[])), '[]') AS enderecos
       FROM cadastro.pessoas p
      WHERE p.id = $1`,
    [id, tiposEndereco],
  );
  return rows[0] ?? null;
}

/** Documento é identidade: achou, é a mesma pessoa. */
export async function findPessoaPorDocumento(
  db: Db,
  documento: string,
  excetoId: string | null = null,
): Promise<{ id: string; nome: string } | null> {
  const { rows } = await db.query<{ id: string; nome: string }>(
    'SELECT id, nome FROM cadastro.pessoas WHERE documento = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)',
    [documento, excetoId],
  );
  return rows[0] ?? null;
}

/** Telefone é só indício: família divide número. Quem decide é quem está cadastrando. */
export async function findPessoasPorTelefone(
  db: Db,
  telefone: string,
  excetoId: string | null = null,
): Promise<{ id: string; nome: string }[]> {
  const { rows } = await db.query<{ id: string; nome: string }>(
    `SELECT id, nome FROM cadastro.pessoas
      WHERE telefone = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)
      ORDER BY ativa DESC, nome LIMIT 5`,
    [telefone, excetoId],
  );
  return rows;
}

async function writePapeis(client: PoolClient, pessoaId: string, papeis: readonly PapelPessoa[]): Promise<void> {
  const nomes = papeis.map((p) => p.papel);
  // O papel retirado fica inativo, e não apagado: pedido e agenda antigos continuam sabendo quem era quem
  await client.query(
    `UPDATE cadastro.pessoas_papeis SET ativo = false
      WHERE pessoa_id = $1 AND ativo AND NOT (papel = ANY($2::cadastro.tipo_papel[]))`,
    [pessoaId, nomes],
  );
  await client.query(
    `INSERT INTO cadastro.pessoas_papeis (pessoa_id, papel, tipo_vinculo)
     SELECT $1, t.papel, t.vinculo FROM unnest($2::cadastro.tipo_papel[], $3::text[]) AS t(papel, vinculo)
     ON CONFLICT (pessoa_id, papel) DO UPDATE SET ativo = true, tipo_vinculo = EXCLUDED.tipo_vinculo`,
    [pessoaId, nomes, papeis.map((p) => p.tipoVinculo)],
  );
}

interface CoordenadaGuardada {
  tipo: TipoEndereco;
  logradouro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  lat: string | null;
  lng: string | null;
  geocodificadoEm: Date | null;
}

type TextoDoEndereco = Pick<Endereco, 'logradouro' | 'cidade' | 'uf' | 'cep'>;

const mesmoTexto = (a: TextoDoEndereco, b: TextoDoEndereco) =>
  a.logradouro === b.logradouro && a.cidade === b.cidade && (a.uf ?? '').trim() === (b.uf ?? '').trim() && a.cep === b.cep;

/**
 * O formulário regrava os endereços inteiros, e por isso apaga e reinsere.
 * **A coordenada sobrevive** (P17): o endereço que volta com o mesmo texto
 * recupera o ponto que tinha, seja o achado pela API, seja a localização colada
 * do WhatsApp. Sem isso, salvar o telefone apagaria o ponto da entrega. O
 * endereço que traz ponto novo (colado agora) grava o novo.
 */
async function writeEnderecos(client: PoolClient, pessoaId: string, enderecos: readonly Endereco[], incluiFiscal: boolean) {
  const { rows: antes } = await client.query<CoordenadaGuardada>(
    `DELETE FROM cadastro.pessoas_enderecos WHERE pessoa_id = $1 AND ($2 OR tipo <> 'cobranca')
     RETURNING tipo, logradouro, cidade, uf, cep, lat, lng, geocodificado_em AS "geocodificadoEm"`,
    [pessoaId, incluiFiscal],
  );
  for (const e of enderecos) {
    const guardada = antes.find((antigo) => antigo.tipo === e.tipo && mesmoTexto(antigo, e));
    const novo = e.lat != null && e.lng != null;
    await client.query(
      `INSERT INTO cadastro.pessoas_enderecos (pessoa_id, tipo, logradouro, cidade, uf, cep, lat, lng, geocodificado_em,
                                               numero, bairro, codigo_ibge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        pessoaId,
        e.tipo,
        e.logradouro,
        e.cidade,
        e.uf,
        e.cep,
        novo ? e.lat : (guardada?.lat ?? null),
        novo ? e.lng : (guardada?.lng ?? null),
        novo ? new Date() : (guardada?.geocodificadoEm ?? null),
        e.numero ?? null,
        e.bairro ?? null,
        e.codigoIbge ?? null,
      ],
    );
  }
}

/**
 * Cria (`id` nulo) ou atualiza a pessoa, na transação do chamador. `fiscal`
 * nulo quer dizer "não mexer": documento e endereço de cobrança ficam como estão.
 */
export async function savePessoa(
  client: PoolClient,
  id: string | null,
  fields: PessoaFields,
  fiscal: FiscalFields | null,
): Promise<{ resultado: 'ok'; id: string } | { resultado: 'nao_encontrado' }> {
  const base = [fields.tipo, fields.nome, fields.telefone, fields.email, fields.observacoes, fields.ativa];
  let pessoaId: string;

  if (id) {
    const { rowCount } = await client.query(
      `UPDATE cadastro.pessoas
          SET tipo = $1, nome = $2, telefone = $3, email = $4, observacoes = $5, ativa = $6,
              documento = CASE WHEN $8 THEN $9 ELSE documento END,
              razao_social = CASE WHEN $8 THEN $10 ELSE razao_social END,
              inscricao_estadual = CASE WHEN $8 THEN $11 ELSE inscricao_estadual END
        WHERE id = $7`,
      [...base, id, fiscal !== null, fiscal?.documento ?? null, fiscal?.razaoSocial ?? null, fiscal?.inscricaoEstadual ?? null],
    );
    if (!rowCount) return { resultado: 'nao_encontrado' };
    pessoaId = id;
  } else {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO cadastro.pessoas (tipo, nome, telefone, email, observacoes, ativa, documento, razao_social, inscricao_estadual)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [...base, fiscal?.documento ?? null, fiscal?.razaoSocial ?? null, fiscal?.inscricaoEstadual ?? null],
    );
    pessoaId = rows[0].id;
  }

  await writePapeis(client, pessoaId, fields.papeis);
  const enderecos = fiscal?.enderecoCobranca ? [...fields.enderecos, fiscal.enderecoCobranca] : fields.enderecos;
  await writeEnderecos(client, pessoaId, enderecos, fiscal !== null);
  return { resultado: 'ok', id: pessoaId };
}

/** "Usar este cadastro": a pessoa que já existe ganha o papel, sem mexer no resto (RF-17). Devolve o nome, ou `null` se não existe. */
export async function addPapel(db: Db, pessoaId: string, papel: Exclude<Papel, 'funcionario'>): Promise<string | null> {
  const { rows } = await db.query<{ nome: string }>(
    `WITH alvo AS (SELECT id, nome FROM cadastro.pessoas WHERE id = $1),
          papel AS (
            INSERT INTO cadastro.pessoas_papeis (pessoa_id, papel)
            SELECT id, $2 FROM alvo
            ON CONFLICT (pessoa_id, papel) DO UPDATE SET ativo = true
          )
     SELECT nome FROM alvo`,
    [pessoaId, papel],
  );
  return rows[0]?.nome ?? null;
}

/** O destino do pedido (P19), completado fora do cadastro: o texto, e o ponto quando se sabe. */
export interface EnderecoDeEntrega {
  logradouro: string;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  ponto: Coordenada | null;
}

/** RF-20: nome e telefone bastam para o pedido; a ficha se completa depois. */
export async function insertClienteRapido(client: PoolClient, input: { nome: string; telefone: string | null }): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    "INSERT INTO cadastro.pessoas (tipo, nome, telefone) VALUES ('pf', $1, $2) RETURNING id",
    [input.nome, input.telefone],
  );
  await writePapeis(client, rows[0].id, [{ papel: 'cliente', tipoVinculo: null }]);
  return rows[0].id;
}
