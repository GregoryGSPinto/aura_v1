'use client';

import { ChatWorkspace } from '@/components/chat/chat-workspace';
import { SplitView } from '@/components/layout/split-view';
import { TerminalPanel } from '@/components/terminal/terminal-panel';
import { useTerminalStore } from '@/lib/terminal-store';

export default function ChatPage() {
  const isTerminalOpen = useTerminalStore((s) => s.isOpen);

  return (
    <SplitView
      left={<ChatWorkspace />}
      right={<TerminalPanel />}
      isRightOpen={isTerminalOpen}
    />
  );
}
