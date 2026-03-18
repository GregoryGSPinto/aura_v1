"use client";

import { ShieldCheck, Waves, Workflow } from "lucide-react";

import type { CompanionTrustSnapshot } from "@/lib/types";

export function TrustPanel({ snapshot }: { snapshot: CompanionTrustSnapshot | null }) {
  return (
    <section className="rounded-xl border border-white/5 bg-zinc-900 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">Trust dashboard</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Transparencia operacional</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-500">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {(snapshot?.signals ?? []).map((signal) => (
          <div key={signal.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-4">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">{signal.source}</p>
            <p className="mt-2 text-sm font-medium">{signal.label}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{signal.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Waves className="h-4 w-4 text-blue-400" />
            Voice runtime
          </div>
          <p className="mt-2 text-sm text-zinc-500">{snapshot?.voice?.pipeline_ready ? 'Pronto' : 'Em standby'}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Workflow className="h-4 w-4 text-blue-400" />
            Politica padrao
          </div>
          <p className="mt-2 text-sm text-zinc-500">{String(snapshot?.policy_state?.default_mode ?? "deny-by-default")}</p>
        </div>
      </div>
    </section>
  );
}
