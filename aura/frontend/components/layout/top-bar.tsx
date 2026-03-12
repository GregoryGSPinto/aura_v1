"use client";

import { Bell, Command, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function TopBar({
  pageMeta,
}: {
  pageMeta: { eyebrow: string; title: string; description: string; accent: string };
}) {
  return (
    <header className="aura-panel sticky top-3 z-30 hidden min-h-[72px] items-center justify-between px-5 py-4 lg:flex">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[var(--text-muted)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent-cyan)]" />
          <span>{pageMeta.eyebrow}</span>
        </div>
        <div className="mt-2">
          <h1 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            {pageMeta.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{pageMeta.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs text-[var(--text-secondary)] xl:flex">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span>Aura pronta</span>
        </div>
        <Button variant="ghost" size="sm" className="hidden md:inline-flex">
          <Command className="h-4 w-4" />
          <span>⌘K</span>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Alertas">
          <Bell className="h-4 w-4" />
        </Button>
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/8"
        >
          <ShieldCheck className="h-4 w-4 text-[var(--accent-cyan)]" />
          <span className="hidden xl:inline">Perfil e ambiente</span>
        </Link>
      </div>
    </header>
  );
}
