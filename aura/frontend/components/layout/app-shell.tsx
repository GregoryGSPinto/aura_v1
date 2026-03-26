"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Component, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { subscribeToPush } from "@/lib/push-service";

import { CommandPalette } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/top-bar";
import { StatusBar } from "@/components/layout/status-bar";
import { ApprovalDialog } from "@/components/safety/approval-dialog";
import { ProactiveAlertBar } from "@/components/proactive/proactive-alert-bar";
import { useDevice } from "@/hooks/use-device";
import { useGlobalShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useWorkspaceStore } from "@/lib/workspace-store";
import { useChatStore } from "@/lib/chat-store";

const MobileLayout = dynamic(
  () => import("@/components/layout/mobile-layout").then((m) => ({ default: m.MobileLayout })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center bg-zinc-950 text-white">
        Carregando...
      </div>
    ),
  },
);

type ErrorBoundaryProps = { children: ReactNode; fallback: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

class MobileErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[MobileLayout crash] falling back to desktop:", error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

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
      <ApprovalDialog />
      <ProactiveAlertBar />
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

  if (isMobile) {
    return (
      <MobileErrorBoundary fallback={<DesktopShell>{children}</DesktopShell>}>
        <MobileLayout>{children}</MobileLayout>
      </MobileErrorBoundary>
    );
  }

  return <DesktopShell>{children}</DesktopShell>;
}
