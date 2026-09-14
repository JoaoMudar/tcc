import type { ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'error' | 'info';

interface NoticeProps {
  tone: Tone;
  children: ReactNode;
}

const TONES: Record<Tone, { className: string; mark: string }> = {
  success: { className: 'border-green-200 bg-green-50 text-green-800', mark: '✓' },
  warning: { className: 'border-amber-200 bg-amber-50 text-amber-800', mark: '!' },
  error: { className: 'border-red-200 bg-red-50 text-red-800', mark: '✕' },
  info: { className: 'border-blue-200 bg-blue-50 text-blue-800', mark: 'i' },
};

/**
 * Aviso na tela. É a confirmação visual imediata de toda gravação (RNF-04):
 * erro é anunciado como alerta, o resto como status.
 */
export function Notice({ tone, children }: NoticeProps) {
  const { className, mark } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-base ${className}`}
    >
      <span aria-hidden="true" className="font-bold">
        {mark}
      </span>
      <div>{children}</div>
    </div>
  );
}
