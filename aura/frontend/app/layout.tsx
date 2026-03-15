import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { ParticleBackground } from '@/components/layout/particle-background';
import { AppProvider } from '@/components/providers/app-provider';
import { AppShell } from '@/components/layout/app-shell';

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
  title: 'Aura | Assistente Operacional Pessoal',
  description: 'Assistente operacional pessoal com backend local, Ollama e automação controlada.',
  keywords: ['AI', 'assistant', 'automation', 'macOS', 'local-first'],
  authors: [{ name: 'Aura' }],
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aura',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1728',
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
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} app-noise font-sans antialiased`}
      >
        <AppProvider>
          <ParticleBackground />
          <AppShell>{children}</AppShell>

          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'color-mix(in srgb, var(--bg-surface-strong) 92%, transparent)',
                border: '1px solid var(--border-default)',
                color: 'var(--fg-primary)',
                borderRadius: '1.1rem',
                boxShadow: 'var(--shadow-soft)',
                backdropFilter: 'blur(18px)',
              },
            }}
          />
        </AppProvider>
      </body>
    </html>
  );
}
