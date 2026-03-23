'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  RefreshCw,
  Search,
} from 'lucide-react';

import { useEditorStore } from '@/lib/editor-store';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';

type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  editable?: boolean;
  size?: number;
  children?: TreeNode[];
};

const LANG_COLORS: Record<string, string> = {
  '.py': 'text-blue-400',
  '.ts': 'text-blue-400',
  '.tsx': 'text-blue-400',
  '.js': 'text-yellow-400',
  '.jsx': 'text-yellow-400',
  '.json': 'text-yellow-300',
  '.md': 'text-zinc-400',
  '.css': 'text-purple-400',
  '.html': 'text-orange-400',
  '.yaml': 'text-green-400',
  '.yml': 'text-green-400',
  '.sh': 'text-green-300',
  '.sql': 'text-cyan-400',
  '.toml': 'text-zinc-400',
};

function getFileColor(name: string): string {
  const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
  return LANG_COLORS[ext] || 'text-zinc-400';
}

function TreeItem({
  node,
  depth,
  onOpenFile,
}: {
  node: TreeNode;
  depth: number;
  onOpenFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const activeFile = useEditorStore((s) => s.activeFile);
  const openFiles = useEditorStore((s) => s.openFiles);
  const isActive = node.type === 'file' && activeFile === node.path;
  const isModified = openFiles.some((f) => f.path === node.path && f.modified);

  if (node.type === 'directory') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          {expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => node.editable !== false && onOpenFile(node.path)}
      className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs transition ${
        isActive
          ? 'bg-white/5 text-zinc-200'
          : node.editable !== false
            ? 'text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-300'
            : 'cursor-default text-zinc-600'
      }`}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
      disabled={node.editable === false}
    >
      <File className={`h-3.5 w-3.5 shrink-0 ${getFileColor(node.name)}`} />
      <span className="truncate">{node.name}</span>
      {isModified && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />}
    </button>
  );
}

export function FileExplorer() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; path: string; directory: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const openFile = useEditorStore((s) => s.openFile);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
      const base = apiUrl.replace(/\/+$/, '');
      const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
      const token = useAuthStore.getState().token || clientEnv.auraToken;

      const res = await fetch(`${prefix}/files/tree?path=aura_v1&depth=3`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) {
        setTree(data.data.tree);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const handleSearch = useCallback(async (query: string) => {
    setSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
      const base = apiUrl.replace(/\/+$/, '');
      const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
      const token = useAuthStore.getState().token || clientEnv.auraToken;

      const res = await fetch(
        `${prefix}/files/search?query=${encodeURIComponent(query)}&path=aura_v1`,
        {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: 'no-store',
        },
      );
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data.results);
      }
    } catch {
      // silent
    }
  }, []);

  const handleOpenFile = useCallback((path: string) => {
    openFile(path);
    setShowSearch(false);
    setSearch('');
    setSearchResults([]);
  }, [openFile]);

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-xs">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-2 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            title="Buscar arquivo (Ctrl+P)"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={fetchTree}
            className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            title="Atualizar"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="border-b border-white/5 px-2 py-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar arquivo..."
            className="w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-blue-500/50"
            autoFocus
          />
          {searchResults.length > 0 && (
            <div className="mt-1 max-h-48 overflow-y-auto">
              {searchResults.map((r) => (
                <button
                  key={r.path}
                  type="button"
                  onClick={() => handleOpenFile(r.path)}
                  className="flex w-full flex-col rounded px-2 py-1 text-left hover:bg-white/5"
                >
                  <span className="text-zinc-200">{r.name}</span>
                  <span className="truncate text-[10px] text-zinc-600">{r.directory}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-1 py-1 scrollbar-thin">
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            onOpenFile={handleOpenFile}
          />
        ))}
        {tree.length === 0 && !loading && (
          <p className="px-2 py-4 text-center text-zinc-600">Nenhum arquivo</p>
        )}
      </div>
    </div>
  );
}
