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
    <section className="rounded-xl border border-white/5 bg-zinc-900 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Memoria governada</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Contexto que a Aura esta usando</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
          <BrainCircuit className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-4">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                {item.kind === "project" ? <FolderKanban className="h-3.5 w-3.5" /> : item.kind === "operational" ? <Sparkles className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                {item.kind}
              </div>
              <p className="mt-3 text-sm font-medium">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{item.content}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">A memoria relevante aparecera aqui conforme a Aura consolidar contexto util.</p>
        )}
      </div>
    </section>
  );
}
