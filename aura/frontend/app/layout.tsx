import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { AppProvider } from '@/components/providers/app-provider';
import { AppShell } from '@/components/layout/app-shell';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aura | Assistente Pessoal',
  description: 'Assistente pessoal com IA local, chat centralizado e automação controlada.',
  keywords: ['AI', 'assistant', 'automation', 'macOS', 'local-first'],
  authors: [{ name: 'Aura' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aura',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <AppProvider>
          <ServiceWorkerRegister />
          <AppShell>{children}</AppShell>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--aura-bg-secondary)',
                border: '1px solid var(--aura-border)',
                color: 'var(--aura-text-primary)',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
              },
            }}
          />
        </AppProvider>
      </body>
    </html>
  );
}
