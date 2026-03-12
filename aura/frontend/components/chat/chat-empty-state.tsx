'use client';

import { AudioLines, Paperclip, Sparkles } from 'lucide-react';

const quickPrompts = [
  'Organize meu foco operacional de hoje.',
  'Quais projetos exigem atencao imediata?',
  'Resuma o status real da Aura agora.',
  'Prepare um plano seguro para revisar este workspace.',
] as const;

export function ChatEmptyState({
  onUsePrompt,
}: {
  onUsePrompt: (prompt: string) => void;
}) {
  return (
    <div className="flex min-h-[48vh] flex-col items-center justify-center px-4 py-10 text-center">
      <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_42%),linear-gradient(135deg,rgba(111,194,255,0.28),rgba(116,129,255,0.14))]">
          <Sparkles className="h-7 w-7 text-[var(--accent-cyan)]" />
        </div>
        <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-primary)] sm:text-4xl">
          Converse com a Aura como um operador pessoal, nao como um chat genérico.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
          Envie contexto, anexe arquivos, dite por voz e acompanhe respostas com estados claros de execucao, audio e disponibilidade.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <AudioLines className="h-3.5 w-3.5" />
            Voz e leitura
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <Paperclip className="h-3.5 w-3.5" />
            Anexos e contexto
          </div>
        </div>
        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onUsePrompt(prompt)}
              className="rounded-[22px] border border-white/10 bg-white/[0.035] px-4 py-4 text-left text-sm text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
