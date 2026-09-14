import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/route-rules';
import { getCurrentSession } from '@/lib/auth/session';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Entrar · Viveiro Mudar' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentSession()) redirect(next);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-brand-dark px-4 py-10">
      <div className="text-center text-white">
        <p className="text-xs font-bold tracking-widest text-brand-muted uppercase">Gestão do viveiro</p>
        <h1 className="mt-1 text-3xl font-extrabold">Viveiro Mudar</h1>
      </div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
        <LoginForm next={next} />
      </div>
      <p className="text-center text-sm text-brand-muted">Esqueceu a senha? Fale com o administrador.</p>
    </main>
  );
}
