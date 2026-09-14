import type { ReactNode } from 'react';

export type PillTone = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

const TONES: Record<PillTone, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
};

/** Selo curto de situação ou papel (mk-pill do F1). */
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}
