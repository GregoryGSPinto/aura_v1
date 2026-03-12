"use client";

import { ShieldCheck, Waves, Workflow } from "lucide-react";

import type { CompanionTrustSnapshot } from "@/lib/types";

export function TrustPanel({ snapshot }: { snapshot: CompanionTrustSnapshot | null }) {
  return (
    <section className="aura-panel px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">Trust dashboard</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Transparencia operacional</h2>
        </div>
        <div className="aura-orb-sm">
          <ShieldCheck className="h-4 w-4 text-[var(--accent-cyan)]" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {(snapshot?.signals ?? []).map((signal) => (
          <div key={signal.id} className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-subtle)]">{signal.source}</p>
            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{signal.label}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{signal.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <Waves className="h-4 w-4 text-[var(--accent-cyan)]" />
            Voice runtime
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{snapshot?.voice?.pipeline_ready ? 'Pronto' : 'Em standby'}</p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <Workflow className="h-4 w-4 text-[var(--accent-cyan)]" />
            Politica padrao
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{String(snapshot?.policy_state?.default_mode ?? "deny-by-default")}</p>
        </div>
      </div>
    </section>
  );
}
