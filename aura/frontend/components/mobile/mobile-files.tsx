'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, File, FolderOpen, RefreshCw, Search } from 'lucide-react';

import { useEditorStore } from '@/lib/editor-store';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';
import { haptic } from '@/hooks/use-haptic';
import { usePullRefresh } from '@/hooks/use-pull-refresh';
import { cn } from '@/lib/utils';

type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  editable?: boolean;
  size?: number;
  children?: TreeNode[];
};

const LANG_COLORS: Record<string, string> = {
  '.py': 'text-blue-400', '.ts': 'text-blue-400', '.tsx': 'text-blue-400',
  '.js': 'text-yellow-400', '.jsx': 'text-yellow-400', '.json': 'text-yellow-300',
  '.md': 'text-zinc-400', '.css': 'text-purple-400', '.html': 'text-orange-400',
};

function getColor(name: string): string {
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  return LANG_COLORS[ext] || 'text-zinc-400';
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function MobileFiles({ onOpenFile }: { onOpenFile?: () => void }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const openFile = useEditorStore((s) => s.openFile);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
      const base = apiUrl.replace(/\/+$/, '');
      const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
      const token = useAuthStore.getState().token || clientEnv.auraToken;
      const res = await fetch(`${prefix}/files/tree?path=aura_v1&depth=4`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) setTree(data.data.tree);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const { pullDistance, refreshing, handlers } = usePullRefresh({ onRefresh: fetchTree });

  // Navigate into folders
  const currentNodes = path.reduce<TreeNode[]>((nodes, segment) => {
    const dir = nodes.find((n) => n.name === segment && n.type === 'directory');
    return dir?.children ?? [];
  }, tree);

  const breadcrumb = ['aura_v1', ...path];

  const handleFileClick = (node: TreeNode) => {
    haptic.light();
    if (node.type === 'directory') {
      setPath([...path, node.name]);
    } else {
      openFile(node.path);
      onOpenFile?.();
    }
  };

  const navigateTo = (index: number) => {
    haptic.light();
    setPath(path.slice(0, index));
  };

  const filtered = search
    ? currentNodes.filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
    : currentNodes;

  const dirs = filtered.filter((n) => n.type === 'directory').sort((a, b) => a.name.localeCompare(b.name));
  const files = filtered.filter((n) => n.type === 'file').sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="mobile-header flex shrink-0 items-center gap-1 border-b border-white/5 bg-zinc-950 px-3 pb-2 overflow-x-auto">
        {breadcrumb.map((seg, i) => (
          <button
            key={i}
            type="button"
            onClick={() => navigateTo(i)}
            className="shrink-0 text-xs text-zinc-500 active:text-zinc-300"
          >
            {i > 0 && <span className="mx-1 text-zinc-700">/</span>}
            <span className={i === breadcrumb.length - 1 ? 'text-zinc-200' : ''}>{seg}</span>
          </button>
        ))}
        <div className="ml-auto">
          <button type="button" onClick={fetchTree} className="rounded p-1 text-zinc-500 active:bg-white/5">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-white/5 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-lg bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Pull refresh indicator */}
      {pullDistance > 0 && (
        <div className="flex items-center justify-center" style={{ height: pullDistance }}>
          <div className={cn('h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent', refreshing && 'animate-spin')} />
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto" {...handlers}>
        {dirs.map((node) => (
          <button
            key={node.path}
            type="button"
            onClick={() => handleFileClick(node)}
            className="flex w-full items-center gap-3 border-b border-white/[0.03] px-4 py-3 text-left active:bg-white/5"
          >
            <FolderOpen className="h-5 w-5 shrink-0 text-zinc-500" />
            <span className="flex-1 truncate text-sm text-zinc-300">{node.name}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700" />
          </button>
        ))}
        {files.map((node) => (
          <button
            key={node.path}
            type="button"
            onClick={() => handleFileClick(node)}
            className="flex w-full items-center gap-3 border-b border-white/[0.03] px-4 py-3 text-left active:bg-white/5"
          >
            <File className={cn('h-5 w-5 shrink-0', getColor(node.name))} />
            <span className="flex-1 truncate text-sm text-zinc-300">{node.name}</span>
            {node.size && <span className="shrink-0 text-xs text-zinc-600">{formatSize(node.size)}</span>}
          </button>
        ))}
        {filtered.length === 0 && !loading && (
          <p className="px-4 py-8 text-center text-sm text-zinc-600">Nenhum arquivo</p>
        )}
      </div>
    </div>
  );
}
