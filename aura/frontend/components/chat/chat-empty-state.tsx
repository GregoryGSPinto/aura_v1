'use client';

const quickPrompts = [
  'Organize meu foco operacional de hoje.',
  'Quais projetos exigem atencao imediata?',
  'Resuma o status real da Aura agora.',
  'Prepare um plano para revisar este workspace.',
] as const;

export function ChatEmptyState({
  onUsePrompt,
}: {
  onUsePrompt: (prompt: string) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center justify-center py-10">
      <div className="mx-auto w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full glow-green">
          <span className="text-[48px] leading-none text-[var(--aura-green)] animate-pulse-subtle">✦</span>
        </div>
        <h2 className="text-base font-light text-white/30">
          Fale ou digite para comecar.
        </h2>
        <p className="mx-auto mt-2 text-[13px] text-white/15">
          Estou aqui pra te dar mais tempo.
        </p>
        <div className="mx-auto mt-8 grid w-full gap-3 sm:grid-cols-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onUsePrompt(prompt)}
              className="min-h-[5.5rem] rounded-xl border border-white/5 bg-[var(--aura-surface)]/50 px-4 py-3.5 text-left text-sm text-zinc-400 transition hover:border-[rgba(0,212,170,0.15)] hover:bg-[var(--aura-surface-elevated)] hover:text-zinc-300"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
