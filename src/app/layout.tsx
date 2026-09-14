import type { Metadata, Viewport } from 'next';
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

/** Casca mínima. O menu e a exigência de sessão ficam no layout de `(sistema)`. */
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
