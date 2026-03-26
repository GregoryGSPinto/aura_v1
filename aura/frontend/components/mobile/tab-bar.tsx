'use client';

import { Code2, FolderTree, LayoutDashboard, MessageSquare, SquareTerminal } from 'lucide-react';
import { haptic } from '@/hooks/use-haptic';
import { cn } from '@/lib/utils';

export type MobileTab = 'chat' | 'editor' | 'files' | 'terminal' | 'dashboard';

const TABS: { id: MobileTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'editor', label: 'Editor', icon: Code2 },
  { id: 'files', label: 'Files', icon: FolderTree },
  { id: 'terminal', label: 'Term', icon: SquareTerminal },
  { id: 'dashboard', label: 'Dash', icon: LayoutDashboard },
];

export function TabBar({
  activeTab,
  onTabChange,
  badges,
}: {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  badges?: Partial<Record<MobileTab, number | boolean>>;
}) {
  return (
    <nav className="tab-bar shrink-0 px-[calc(var(--sal)+0.75rem)] pr-[calc(var(--sar)+0.75rem)] pt-2">
      <div className="mx-auto flex max-w-md items-end rounded-[1.45rem] border border-white/5 bg-[color:color-mix(in_srgb,var(--bg-surface)_86%,transparent)] px-1.5 pb-1.5 pt-1 shadow-[0_-14px_36px_rgba(0,0,0,0.26)] backdrop-blur-xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badge = badges?.[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                haptic.light();
                onTabChange(tab.id);
              }}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 rounded-[1rem] pb-1.5 pt-2 transition-colors',
                isActive ? 'bg-white/[0.04] text-blue-400' : 'text-zinc-600',
              )}
            >
              <div className="relative">
                <Icon className="h-5.5 w-5.5" />
                {badge && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {typeof badge === 'number' ? badge : ''}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium', isActive ? 'text-blue-300' : 'text-zinc-600')}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
