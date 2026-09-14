/** Estado devolvido pelas Server Actions de formulário a `useActionState`. */
export interface FormState {
  error?: string;
  success?: string;
  /** Valores digitados, para o formulário não esvaziar quando a action recusa. */
  fields?: Record<string, string>;
}

export const EMPTY_FORM_STATE: FormState = {};

export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}
