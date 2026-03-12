"use client";

import { BrainCircuit, Clock3, FolderKanban, Sparkles } from "lucide-react";

import type { CompanionMemorySnapshot } from "@/lib/types";

export function MemoryPanel({ snapshot }: { snapshot: CompanionMemorySnapshot | null }) {
  const items = [
    ...(snapshot?.preferences ?? []),
    ...(snapshot?.operational_memory ?? []),
    ...(snapshot?.recent_context ?? []),
  ].slice(0, 6);

  return (
    <section className="aura-panel px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Memoria governada</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Contexto que a Aura esta usando</h2>
        </div>
        <div className="aura-orb-sm">
          <BrainCircuit className="h-4 w-4 text-[var(--accent-cyan)]" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--text-subtle)]">
                {item.kind === "project" ? <FolderKanban className="h-3.5 w-3.5" /> : item.kind === "operational" ? <Sparkles className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                {item.kind}
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.content}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--text-muted)]">A memoria relevante aparecera aqui conforme a Aura consolidar contexto util.</p>
        )}
      </div>
    </section>
  );
}
