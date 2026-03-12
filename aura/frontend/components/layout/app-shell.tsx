"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { CommandPalette } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { auraPageMeta } from "@/lib/design-system/tokens";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
      <div className="relative z-10 min-h-screen overflow-x-hidden">
        <div className="mx-auto flex min-h-screen w-full max-w-[1680px] gap-4 px-0 pb-0 pt-0 sm:px-3 sm:py-3 lg:px-4 lg:py-4">
          <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />

          <div className="flex min-h-screen min-w-0 flex-1 flex-col px-0 sm:px-0">
            <TopBar pageMeta={pageMeta} onOpenSidebar={() => setMobileSidebarOpen(true)} />
            <main className="min-w-0 flex-1 px-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:px-1 lg:px-0 lg:pb-4">
              {children}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
