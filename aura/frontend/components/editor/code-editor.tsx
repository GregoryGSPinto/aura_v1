'use client';

/**
 * Code Editor — Lightweight editor with syntax highlighting, tabs, auto-save.
 *
 * - Textarea for editing with syntax-highlighted overlay
 * - Line numbers
 * - Tabs with modified indicator
 * - Ctrl+S saves, auto-save after 2s debounce
 * - Cursor position in status bar
 */

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { highlightLine } from '@/components/editor/syntax-highlighter';
import { useEditorStore, type OpenFile } from '@/lib/editor-store';
import { cn } from '@/lib/utils';

function EditorTab({ file, isActive }: { file: OpenFile; isActive: boolean }) {
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const closeFile = useEditorStore((s) => s.closeFile);

  return (
    <div
      className={cn(
        'group flex shrink-0 items-center gap-1.5 border-r border-white/5 px-3 py-1.5 text-xs transition',
        isActive
          ? 'bg-zinc-900 text-zinc-200'
          : 'bg-zinc-950 text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-400',
      )}
    >
      <button
        type="button"
        onClick={() => setActiveFile(file.path)}
        className="flex items-center gap-1.5"
      >
        {file.modified && (
          <span className="h-2 w-2 rounded-full bg-blue-400" />
        )}
        <span className="max-w-[120px] truncate">{file.name}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          closeFile(file.path);
        }}
        className="rounded p-0.5 opacity-0 transition hover:bg-white/10 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="flex h-full items-center justify-center bg-zinc-950">
      <div className="text-center">
        <p className="text-sm text-zinc-600">Nenhum arquivo aberto</p>
        <p className="mt-1 text-xs text-zinc-700">
          Selecione um arquivo no Explorer ou use Ctrl+P
        </p>
      </div>
    </div>
  );
}

export function CodeEditor() {
  const openFiles = useEditorStore((s) => s.openFiles);
  const activeFile = useEditorStore((s) => s.activeFile);
  const updateContent = useEditorStore((s) => s.updateContent);
  const saveFile = useEditorStore((s) => s.saveFile);
  const setCursor = useEditorStore((s) => s.setCursor);

  const file = openFiles.find((f) => f.path === activeFile);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current && lineNumRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Track cursor position
  const handleSelect = useCallback(() => {
    if (!textareaRef.current || !file) return;
    const pos = textareaRef.current.selectionStart;
    const text = file.content.slice(0, pos);
    const lines = text.split('\n');
    setCursor(lines.length, (lines[lines.length - 1]?.length ?? 0) + 1);
  }, [file, setCursor]);

  // Auto-save debounce
  const handleChange = useCallback(
    (content: string) => {
      if (!file) return;
      updateContent(file.path, content);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveFile(file.path);
      }, 2000);
    },
    [file, updateContent, saveFile],
  );

  // Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (activeFile) saveFile(activeFile);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFile, saveFile]);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Handle Tab key in textarea
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const val = ta.value;
        const newVal = val.substring(0, start) + '  ' + val.substring(end);
        handleChange(newVal);
        // Restore cursor
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [handleChange],
  );

  if (openFiles.length === 0) return <EmptyEditor />;

  const lines = file ? file.content.split('\n') : [];

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Tabs */}
      <div className="flex shrink-0 overflow-x-auto border-b border-white/5 bg-zinc-950 scrollbar-thin">
        {openFiles.map((f) => (
          <EditorTab key={f.path} file={f} isActive={f.path === activeFile} />
        ))}
      </div>

      {/* Editor area */}
      {file ? (
        <div className="relative flex flex-1 overflow-hidden font-mono text-sm leading-6">
          {/* Line numbers */}
          <div
            ref={lineNumRef}
            className="shrink-0 select-none overflow-hidden border-r border-white/5 bg-zinc-950 px-3 py-2 text-right text-zinc-600"
          >
            {lines.map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Editor content */}
          <div className="relative flex-1 overflow-hidden">
            {/* Syntax highlight overlay */}
            <div
              ref={highlightRef}
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre p-2 text-zinc-300"
              aria-hidden="true"
            >
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="leading-6"
                  dangerouslySetInnerHTML={{
                    __html: highlightLine(line, file.language) || '&nbsp;',
                  }}
                />
              ))}
            </div>

            {/* Actual textarea */}
            <textarea
              ref={textareaRef}
              value={file.content}
              onChange={(e) => handleChange(e.target.value)}
              onScroll={handleScroll}
              onSelect={handleSelect}
              onClick={handleSelect}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 h-full w-full resize-none bg-transparent p-2 font-mono text-sm leading-6 text-transparent caret-zinc-300 outline-none"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>
      ) : (
        <EmptyEditor />
      )}
    </div>
  );
}
