"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { subscribeToPush } from "@/lib/push-service";

import { CommandPalette } from "@/components/layout/command-palette";
import { MobileLayout } from "@/components/layout/mobile-layout";
import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/top-bar";
import { StatusBar } from "@/components/layout/status-bar";
import { useDevice } from "@/hooks/use-device";
import { useGlobalShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { useChatStore } from "@/lib/chat-store";

function DesktopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isChatRoute = pathname === "/chat" || pathname === "/";
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed);

  // Global keyboard shortcuts
  useGlobalShortcuts();

  // Sync sidebar collapsed state from workspace preset
  const setSidebarCollapsed = useChatStore((s) => s.setSidebarCollapsed);
  const preset = useWorkspaceStore((s) => s.getActivePreset());
  useEffect(() => {
    if (isChatRoute) {
      if (preset.layout.leftSidebar === 'hidden') {
        setSidebarCollapsed(true);
      } else if (preset.layout.leftSidebar === 'collapsed') {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    }
  }, [activeWorkspace, isChatRoute, preset.layout.leftSidebar, setSidebarCollapsed]);

  const hideSidebar = isChatRoute && preset.layout.leftSidebar === 'hidden';

  return (
    <>
      <CommandPalette />
      <div className="flex h-dvh flex-col overflow-hidden bg-[var(--aura-bg-primary)]">
        <AppHeader onOpenSidebar={() => setMobileSidebarOpen(true)} />

        <div className="flex min-h-0 flex-1">
          {!hideSidebar && (
            <Sidebar
              mobileOpen={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
          )}

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {isChatRoute ? (
              <>
                <div className="flex-1 overflow-hidden">
                  {children}
                </div>
                <StatusBar />
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isLoginRoute = pathname === "/login";
  const { isMobile } = useDevice();

  // Auto-subscribe to push after login
  useEffect(() => {
    if (!isLoginRoute) {
      subscribeToPush().catch(() => {});
    }
  }, [isLoginRoute]);

  if (isLoginRoute) return <>{children}</>;

  if (isMobile) return <MobileLayout>{children}</MobileLayout>;

  return <DesktopShell>{children}</DesktopShell>;
}
