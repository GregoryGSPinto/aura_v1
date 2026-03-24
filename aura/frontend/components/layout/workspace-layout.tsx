'use client';

import { Fragment, useCallback, useState } from 'react';

import { ChatSidePanel } from '@/components/chat/chat-side-panel';
import { ChatWorkspace } from '@/components/chat/chat-workspace';
import { CodeEditor } from '@/components/editor/code-editor';
import { FileExplorer } from '@/components/editor/file-explorer';
import { GitPanel } from '@/components/editor/git-panel';
import { PreviewPanel } from '@/components/editor/preview-panel';
import { ContextSidebar } from '@/components/layout/context-sidebar';
import { DragHandle } from '@/components/layout/drag-handle';
import { TerminalPanel } from '@/components/terminal/terminal-panel';
import { useWorkspaceStore, WORKSPACE_PRESETS } from '@/lib/workspace-store';

type PanelEntry = {
  id: string;
  component: React.ReactNode;
};

export function WorkspaceLayout() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setActivePanel = useWorkspaceStore((s) => s.setActivePanel);
  const preset =
    WORKSPACE_PRESETS[activeWorkspace] ??
    useWorkspaceStore.getState().customWorkspaces.find((w) => w.id === activeWorkspace) ??
    WORKSPACE_PRESETS.chat;

  const layout = preset.layout;

  const [panelSizes, setPanelSizes] = useState<Record<string, number>>({});
  const [terminalHeight, setTerminalHeight] = useState(200);

  const handlePanelDrag = useCallback(
    (panelIndex: number, delta: number) => {
      setPanelSizes((prev) => {
        const key = String(panelIndex);
        const current = prev[key] ?? 0;
        return { ...prev, [key]: current + delta };
      });
    },
    [],
  );

  const handleTerminalDrag = useCallback((delta: number) => {
    setTerminalHeight((h) => Math.max(80, Math.min(500, h - delta)));
  }, []);

  // Chat as main content (chat, monitor, focus modes)
  if (layout.chat === 'main') {
    return (
      <div className="workspace-panel flex h-full min-h-0 flex-1 px-3 py-3 lg:px-4 lg:py-4">
        <div className="mx-auto grid h-full w-full max-w-[1440px] min-h-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,52rem)_minmax(0,1fr)] xl:gap-6">
          <div
            className="shell-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] xl:col-start-2"
            onFocus={() => setActivePanel('chat')}
          >
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <ChatWorkspace />
            </div>
            {layout.terminal && (
              <>
                <DragHandle direction="horizontal" onDrag={handleTerminalDrag} />
                <div
                  className="shrink-0 overflow-hidden"
                  style={{ height: terminalHeight }}
                  onFocus={() => setActivePanel('terminal')}
                >
                  <TerminalPanel />
                </div>
              </>
            )}
          </div>
          <div className="hidden min-h-0 xl:flex xl:col-start-3 xl:justify-end">
            <ContextSidebar />
          </div>
        </div>
      </div>
    );
  }

  // Build panels for IDE-like layouts (code, review)
  const panels: PanelEntry[] = [];

  if (layout.fileExplorer) {
    panels.push({ id: 'files', component: <FileExplorer /> });
  }

  if (layout.editor) {
    const editorPanel = (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden">
          <CodeEditor />
        </div>
        {layout.terminal && (
          <>
            <DragHandle direction="horizontal" onDrag={handleTerminalDrag} />
            <div className="shrink-0 overflow-hidden" style={{ height: terminalHeight }}>
              <TerminalPanel />
            </div>
          </>
        )}
      </div>
    );
    panels.push({ id: 'editor', component: editorPanel });
  } else if (layout.terminal) {
    panels.push({ id: 'terminal', component: <TerminalPanel /> });
  }

  if (layout.preview) {
    panels.push({ id: 'preview', component: <PreviewPanel /> });
  }

  if (layout.chat === 'side-panel') {
    panels.push({ id: 'chat', component: <ChatSidePanel /> });
  }

  return (
    <div className="workspace-panel flex h-full min-h-0 flex-1">
      {panels.map((panel, i) => {
        const ratio = layout.splitRatio?.[i];
        const sizeAdjust = panelSizes[String(i)] ?? 0;

        return (
          <Fragment key={panel.id}>
            {i > 0 && (
              <DragHandle
                direction="vertical"
                onDrag={(delta) => handlePanelDrag(i - 1, delta)}
                onDoubleClick={() => setPanelSizes({})}
              />
            )}
            <div
              className="min-h-0 min-w-0 overflow-hidden"
              style={{
                flex: ratio ?? 1,
                ...(sizeAdjust !== 0 ? { flexGrow: 0, flexBasis: `calc(${(ratio ?? 1) / (layout.splitRatio?.reduce((a, b) => a + b, 0) ?? panels.length)} * 100% + ${sizeAdjust}px)` } : {}),
              }}
              onFocus={() => setActivePanel(panel.id)}
            >
              {panel.component}
            </div>
          </Fragment>
        );
      })}
      <ContextSidebar />
    </div>
  );
}
