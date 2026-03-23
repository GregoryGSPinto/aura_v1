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
    <nav className="tab-bar flex shrink-0 items-end border-t border-white/5 bg-zinc-950/80 backdrop-blur-xl">
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
              'relative flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2 transition-colors',
              isActive ? 'text-blue-400' : 'text-zinc-600',
            )}
          >
            <div className="relative">
              <Icon className="h-6 w-6" />
              {badge && (
                <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {typeof badge === 'number' ? badge : ''}
                </span>
              )}
            </div>
            {isActive && <span className="text-[10px] font-medium">{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
