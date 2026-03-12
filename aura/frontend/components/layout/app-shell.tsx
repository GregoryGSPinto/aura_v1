"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CommandPalette } from "@/components/layout/command-palette";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { ContextPanel } from "@/components/panels/context-panel";
import { auraPageMeta } from "@/lib/design-system/tokens";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const pageMeta =
    auraPageMeta[pathname] ??
    ({
      eyebrow: "Aura",
      title: "Aura",
      description: "AI Companion Operacional Pessoal",
      accent: "core",
    } as const);

  return (
    <>
      <CommandPalette />
      <div className="relative z-10 min-h-screen">
        <div className="mx-auto grid min-h-screen max-w-[1760px] grid-cols-1 gap-4 px-3 pb-28 pt-3 sm:px-4 md:px-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-6 lg:pb-6 xl:grid-cols-[18rem_minmax(0,1fr)_21rem] xl:gap-5">
          <Sidebar />

          <div className="flex min-h-screen min-w-0 flex-col gap-4">
            <TopBar pageMeta={pageMeta} />
            <main className="min-w-0 flex-1">
              {children}
            </main>
          </div>

          <ContextPanel pageMeta={pageMeta} />
        </div>
      </div>
      <MobileNav />
    </>
  );
}
