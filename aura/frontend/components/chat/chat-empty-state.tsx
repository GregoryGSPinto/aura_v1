'use client';

import { Sparkles } from 'lucide-react';

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
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900">
          <Sparkles className="h-5 w-5 text-zinc-400" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
          Como posso ajudar?
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-500">
          Converse, pesquise ou peça uma analise.
        </p>
        <div className="mx-auto mt-6 grid w-full gap-3 sm:grid-cols-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onUsePrompt(prompt)}
              className="min-h-[5.5rem] rounded-xl border border-white/5 bg-zinc-900/50 px-4 py-3.5 text-left text-sm text-zinc-400 transition hover:border-white/10 hover:bg-zinc-900 hover:text-zinc-300"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
