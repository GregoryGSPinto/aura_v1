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
      <div className="shell-panel w-full max-w-[56rem] rounded-[2.25rem] p-6 sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-[var(--border-default)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_22%,transparent),color-mix(in_srgb,var(--accent-secondary)_14%,transparent))]">
          <Sparkles className="h-7 w-7 text-[var(--fg-primary)]" />
        </div>
        <h2 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.06em] text-[var(--fg-primary)] sm:text-4xl">
          Uma conversa premium, centrada na leitura e pronta para operacao.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[var(--fg-muted)] sm:text-base">
          A Aura foi reorganizada para manter foco, contexto e clareza no centro. Use prompts, voz e anexos sem perder serenidade visual.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-3 py-2 text-xs text-[var(--fg-secondary)]">
            <AudioLines className="h-3.5 w-3.5" />
            Voz e leitura
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--bg-surface-soft)_94%,transparent)] px-3 py-2 text-xs text-[var(--fg-secondary)]">
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
              className="shell-card rounded-[1.35rem] px-4 py-4 text-left text-sm text-[var(--fg-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
