"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

import { CommandPalette } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/top-bar";
import { StatusBar } from "@/components/layout/status-bar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isChatRoute = pathname === "/chat" || pathname === "/";

  return (
    <>
      <CommandPalette />
      <div className="flex h-dvh flex-col overflow-hidden bg-[var(--aura-bg-primary)]">
        <AppHeader onOpenSidebar={() => setMobileSidebarOpen(true)} />

        <div className="flex min-h-0 flex-1">
          <Sidebar
            mobileOpen={mobileSidebarOpen}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          />

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {isChatRoute ? (
              <>
                <div className="flex-1 overflow-hidden">
                  {children}
                </div>
                <StatusBar />
              </>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
