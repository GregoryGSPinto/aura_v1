'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { MobileChat } from '@/components/mobile/mobile-chat';
import { MobileEditor } from '@/components/mobile/mobile-editor';
import { MobileFiles } from '@/components/mobile/mobile-files';
import { MobileTerminal } from '@/components/mobile/mobile-terminal';
import { MobileDashboard } from '@/components/mobile/mobile-dashboard';
import { MobileToastContainer } from '@/components/mobile/mobile-toast';
import { ConnectionBar } from '@/components/mobile/connection-bar';
import { FloatingTerminal } from '@/components/mobile/floating-terminal';
import { QuickPanel } from '@/components/mobile/quick-panel';
import { TabBar, type MobileTab } from '@/components/mobile/tab-bar';
import { useSwipe } from '@/hooks/use-swipe';
import { useAdaptiveTheme } from '@/hooks/use-adaptive-theme';
import { haptic } from '@/hooks/use-haptic';

const TAB_ORDER: MobileTab[] = ['chat', 'editor', 'files', 'terminal', 'dashboard'];

export function MobileLayout({ children }: { children?: ReactNode }) {
  const [activeTab, setActiveTab] = useState<MobileTab>('chat');
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Night mode between 22h-6h
  useAdaptiveTheme();

  // Swipe to change tabs
  useSwipe(contentRef, {
    onSwipeLeft: () => {
      const idx = TAB_ORDER.indexOf(activeTab);
      if (idx < TAB_ORDER.length - 1) {
        haptic.light();
        setActiveTab(TAB_ORDER[idx + 1]);
      }
    },
    onSwipeRight: () => {
      const idx = TAB_ORDER.indexOf(activeTab);
      if (idx > 0) {
        haptic.light();
        setActiveTab(TAB_ORDER[idx - 1]);
      }
    },
    onSwipeDown: () => {
      if (activeTab === 'chat') setQuickPanelOpen(true);
    },
    threshold: 60,
  });

  const handleOpenFile = () => setActiveTab('editor');

  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      <ConnectionBar />
      <MobileToastContainer />
      <QuickPanel open={quickPanelOpen} onClose={() => setQuickPanelOpen(false)} />

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-hidden">
        <div className={activeTab === 'chat' ? 'h-full' : 'hidden'}>
          <MobileChat />
        </div>
        <div className={activeTab === 'editor' ? 'h-full' : 'hidden'}>
          <MobileEditor />
        </div>
        <div className={activeTab === 'files' ? 'h-full' : 'hidden'}>
          <MobileFiles onOpenFile={handleOpenFile} />
        </div>
        <div className={activeTab === 'terminal' ? 'h-full' : 'hidden'}>
          <MobileTerminal />
        </div>
        <div className={activeTab === 'dashboard' ? 'h-full' : 'hidden'}>
          <MobileDashboard />
        </div>
      </div>

      {/* Floating terminal widget */}
      <FloatingTerminal />

      {/* Tab bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
