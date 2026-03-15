import Link from 'next/link';
import { ArrowRight, MessageSquareText, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-[980px] items-center px-4 py-10 sm:px-6">
      <div className="shell-panel w-full rounded-[2.4rem] p-6 sm:p-8 lg:p-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-[var(--border-default)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_24%,transparent),color-mix(in_srgb,var(--accent-secondary)_14%,transparent))]">
            <Sparkles className="h-7 w-7 text-[var(--fg-primary)]" />
          </div>

          <p className="mt-6 text-[11px] uppercase tracking-[0.3em] text-[var(--fg-subtle)]">
            Aura
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.07em] text-[var(--fg-primary)] sm:text-5xl">
            Assistente operacional premium, pronto para abrir direto no chat.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[var(--fg-muted)]">
            A raiz da aplicação agora responde corretamente e aponta para a experiência principal da Aura. Use o acesso direto abaixo para entrar na conversa.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/chat"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)] bg-[linear-gradient(135deg,var(--accent-primary-strong),var(--accent-secondary))] px-5 text-sm font-medium text-white shadow-[0_12px_26px_rgba(80,111,181,0.24)] transition hover:brightness-105"
            >
              <MessageSquareText className="h-4 w-4" />
              Abrir Aura
              <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="shell-chip text-sm">
              Entrada principal protegida para deploy e navegação direta
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
