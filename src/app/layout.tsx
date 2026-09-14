import type { Metadata, Viewport } from 'next';
import { AppNav } from '@/components/AppNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Viveiro Mudar',
  description: 'Gestão do viveiro: cadastros, produção e pedidos.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#166534',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <div className="md:flex md:min-h-dvh">
          <AppNav />
          {/* pb-24: espaço para a navegação fixa no rodapé do celular */}
          <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>
        </div>
      </body>
    </html>
  );
}
