'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, MoreHorizontal, Play, Save } from 'lucide-react';

import { useEditorStore } from '@/lib/editor-store';
import { haptic } from '@/hooks/use-haptic';
import { cn } from '@/lib/utils';

const CodeEditor = dynamic(() => import('@/components/editor/code-editor').then((m) => ({ default: m.CodeEditor })), { ssr: false });

const CODE_SHORTCUTS = [
  { label: 'Tab', value: '  ' },
  { label: '{ }', value: '{}' },
  { label: '( )', value: '()' },
  { label: '[ ]', value: '[]' },
  { label: '" "', value: '""' },
  { label: "' '", value: "''" },
  { label: ';', value: ';' },
  { label: ':', value: ':' },
  { label: '.', value: '.' },
  { label: '=>', value: ' => ' },
  { label: '/', value: '/' },
  { label: '=', value: ' = ' },
];

export function MobileEditor() {
  const activeFile = useEditorStore((s) => s.activeFile);
  const openFiles = useEditorStore((s) => s.openFiles);
  const file = openFiles.find((f) => f.path === activeFile);
  const [showFiles, setShowFiles] = useState(!activeFile);

  if (!activeFile || showFiles) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-zinc-500">Nenhum arquivo aberto</p>
        <p className="mt-1 text-xs text-zinc-600">Use a tab Files para abrir um arquivo</p>
      </div>
    );
  }

  const fileName = activeFile.split('/').pop() ?? activeFile;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mobile-header flex shrink-0 items-center justify-between border-b border-white/5 bg-zinc-950 px-2 pb-2">
        <button type="button" onClick={() => setShowFiles(true)} className="rounded-lg p-2 text-zinc-400 active:bg-white/5">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          <span className="truncate text-sm font-medium text-zinc-200">{fileName}</span>
          {file?.modified && <span className="h-2 w-2 rounded-full bg-blue-400" />}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-lg p-2 text-zinc-400 active:bg-white/5">
            <Save className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-lg p-2 text-zinc-400 active:bg-white/5">
            <Play className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden text-[14px]">
        <CodeEditor />
      </div>

      {/* Code toolbar */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-white/5 bg-zinc-900 px-2 py-1.5">
        {CODE_SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() => haptic.light()}
            className="shrink-0 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 active:bg-zinc-700"
          >
            {shortcut.label}
          </button>
        ))}
      </div>
    </div>
  );
}
