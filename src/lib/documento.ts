/**
 * CPF, CNPJ e telefone (RF-17). Funções puras, sem SQL: o formulário usa as
 * mesmas no navegador, na saída do campo, e a action no servidor.
 */

export type TipoPessoa = 'pf' | 'pj';

export function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

function allSameDigit(digits: string): boolean {
  return /^(\d)\1*$/.test(digits);
}

function cpfDigit(digits: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

export function isCpf(text: string): boolean {
  const digits = onlyDigits(text);
  if (digits.length !== 11 || allSameDigit(digits)) return false;
  return cpfDigit(digits, 9) === Number(digits[9]) && cpfDigit(digits, 10) === Number(digits[10]);
}

function cnpjDigit(digits: string, length: number): number {
  let sum = 0;
  let weight = length - 7;
  for (let i = 0; i < length; i++) {
    sum += Number(digits[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isCnpj(text: string): boolean {
  const digits = onlyDigits(text);
  if (digits.length !== 14 || allSameDigit(digits)) return false;
  return cnpjDigit(digits, 12) === Number(digits[12]) && cnpjDigit(digits, 13) === Number(digits[13]);
}

/** Documento opcional: vazio vira `null`; preenchido tem de ser CPF (PF) ou CNPJ (PJ) válido. Devolve só os dígitos. */
export function validateDocumento(tipo: TipoPessoa, text: string): { error: string } | { value: string | null } {
  const digits = onlyDigits(text);
  if (text.trim() === '') return { value: null };
  if (tipo === 'pf') return isCpf(digits) ? { value: digits } : { error: 'CPF inválido. Confira os números.' };
  return isCnpj(digits) ? { value: digits } : { error: 'CNPJ inválido. Confira os números.' };
}

/** 52998224725 → 529.982.247-25; 11222333000181 → 11.222.333/0001-81. */
export function formatDocumento(digits: string): string {
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return digits;
}

/** Telefone opcional, com DDD: 10 ou 11 dígitos. Grava só os dígitos, para a busca achar de qualquer jeito digitado. */
export function validateTelefone(text: string): { error: string } | { value: string | null } {
  if (text.trim() === '') return { value: null };
  let digits = onlyDigits(text);
  // 55 do código do país, quando colado do WhatsApp
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return { error: 'Telefone precisa ter DDD e número, como (47) 99612-4408.' };
  return { value: digits };
}

/** 47996124408 → (47) 99612-4408. */
export function formatTelefone(digits: string | null): string {
  if (!digits) return '';
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return digits;
}
