"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

import { auraNavigation } from "@/lib/design-system/tokens";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname() ?? "/";

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-3 flex flex-col gap-4">
        <div className="aura-panel px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="aura-orb">
              <Sparkles className="h-5 w-5 text-[var(--accent-cyan)]" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-muted)]">Aura</p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Companion operacional
              </h2>
            </div>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
            Presenca pessoal para contexto, memoria e execucao real com controle.
          </p>
        </div>

        <nav className="aura-panel px-3 py-3">
          {auraNavigation.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <p className="px-3 pb-2 text-[11px] uppercase tracking-[0.24em] text-[var(--text-subtle)]">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={`${group.title}-${item.label}`}
                      href={item.href}
                      className={cn(
                        "group flex items-start gap-3 rounded-[18px] px-3 py-3 transition-all duration-200",
                        isActive
                          ? "bg-[linear-gradient(135deg,rgba(107,208,255,0.12),rgba(138,160,255,0.08))] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_rgba(107,208,255,0.22)]"
                          : "text-[var(--text-muted)] hover:bg-white/[0.045] hover:text-[var(--text-primary)]",
                      )}
                    >
                      <div className={cn("mt-0.5 rounded-[14px] border px-2 py-2", isActive ? "border-[var(--border-strong)] bg-white/[0.04]" : "border-white/5 bg-white/[0.02]")}>
                        <Icon className={cn("h-4 w-4", isActive ? "text-[var(--accent-cyan)]" : "text-[var(--text-subtle)] group-hover:text-[var(--text-secondary)]")} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--text-subtle)]">{item.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
