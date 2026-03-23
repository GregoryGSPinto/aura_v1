'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Minus,
  Plus,
  RefreshCw,
  Upload,
  Download,
} from 'lucide-react';

import { useGitStore, type DiffHunk } from '@/lib/git-store';
import { DiffViewer } from './diff-viewer';
import { clientEnv } from '@/lib/env';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

function getApiPrefix(): string {
  const apiUrl = clientEnv.apiUrl || 'http://localhost:8000';
  const base = apiUrl.replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

function getHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token || clientEnv.auraToken;
  return {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function GitPanel() {
  const {
    branch, ahead, behind, modified, staged, untracked, deleted,
    commits, loading, repoPath, setStatus, setCommits, setLoading,
  } = useGitStore();

  const [commitMsg, setCommitMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [diffFile, setDiffFile] = useState<string | null>(null);
  const [diffHunks, setDiffHunks] = useState<DiffHunk[]>([]);
  const [actionMsg, setActionMsg] = useState('');

  const prefix = getApiPrefix();

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${prefix}/git/status?path=${encodeURIComponent(repoPath)}`, { headers: getHeaders() });
      const json = await res.json();
      if (json.success) setStatus(json.data);
    } catch { /* silent */ }
    setLoading(false);
  }, [prefix, repoPath, setStatus, setLoading]);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`${prefix}/git/log?path=${encodeURIComponent(repoPath)}&limit=10`, { headers: getHeaders() });
      const json = await res.json();
      if (json.success) setCommits(json.data.commits);
    } catch { /* silent */ }
  }, [prefix, repoPath, setCommits]);

  useEffect(() => {
    fetchStatus();
    fetchLog();
  }, [fetchStatus, fetchLog]);

  const handleStage = async (files?: string[]) => {
    await fetch(`${prefix}/git/stage`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ path: repoPath, files: files || null }),
    });
    fetchStatus();
  };

  const handleUnstage = async (files?: string[]) => {
    await fetch(`${prefix}/git/unstage`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ path: repoPath, files: files || null }),
    });
    fetchStatus();
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    const res = await fetch(`${prefix}/git/commit`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ path: repoPath, message: commitMsg }),
    });
    const json = await res.json();
    if (json.success) {
      setCommitMsg('');
      setActionMsg('Committed!');
      setTimeout(() => setActionMsg(''), 3000);
    } else {
      setActionMsg(json.error || 'Commit failed');
    }
    fetchStatus();
    fetchLog();
  };

  const handlePush = async () => {
    setActionMsg('Pushing...');
    const res = await fetch(`${prefix}/git/push`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ path: repoPath }),
    });
    const json = await res.json();
    setActionMsg(json.success ? 'Pushed!' : (json.error || 'Push failed'));
    setTimeout(() => setActionMsg(''), 3000);
    fetchStatus();
  };

  const handlePull = async () => {
    setActionMsg('Pulling...');
    const res = await fetch(`${prefix}/git/pull`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ path: repoPath }),
    });
    const json = await res.json();
    setActionMsg(json.success ? 'Pulled!' : (json.error || 'Pull failed'));
    setTimeout(() => setActionMsg(''), 3000);
    fetchStatus();
  };

  const handleViewDiff = async (file: string) => {
    const res = await fetch(`${prefix}/git/diff?path=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(file)}`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (json.success) {
      setDiffFile(file);
      setDiffHunks(json.data.hunks);
    }
  };

  if (diffFile) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-1.5">
          <span className="text-xs text-zinc-400">{diffFile}</span>
          <button
            type="button"
            onClick={() => setDiffFile(null)}
            className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/5"
          >
            Back
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <DiffViewer file={diffFile} hunks={diffHunks} />
        </div>
      </div>
    );
  }

  const changeCount = modified.length + untracked.length + deleted.length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-950 text-xs">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-1.5 text-zinc-300">
          <GitBranch className="h-3.5 w-3.5 text-purple-400" />
          <span>{branch}</span>
          {ahead > 0 && <span className="text-green-400">↑{ahead}</span>}
          {behind > 0 && <span className="text-orange-400">↓{behind}</span>}
        </div>
        <button
          type="button"
          onClick={() => { fetchStatus(); fetchLog(); }}
          className="rounded p-1 text-zinc-500 hover:bg-white/5"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Staged Changes */}
        {staged.length > 0 && (
          <div className="border-b border-white/5 py-1">
            <div className="flex items-center justify-between px-3 py-1 text-zinc-400">
              <span>Staged ({staged.length})</span>
              <button type="button" onClick={() => handleUnstage()} className="rounded p-0.5 hover:bg-white/5">
                <Minus className="h-3 w-3" />
              </button>
            </div>
            {staged.map((f) => (
              <div key={f} className="group flex items-center gap-1 px-3 py-0.5 hover:bg-white/5">
                <span className="w-4 text-center font-bold text-green-400">A</span>
                <button type="button" onClick={() => handleViewDiff(f)} className="flex-1 truncate text-left text-zinc-300 hover:text-white">
                  {f}
                </button>
                <button type="button" onClick={() => handleUnstage([f])} className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100">
                  <Minus className="h-3 w-3 text-zinc-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Changes */}
        {changeCount > 0 && (
          <div className="border-b border-white/5 py-1">
            <div className="flex items-center justify-between px-3 py-1 text-zinc-400">
              <span>Changes ({changeCount})</span>
              <button type="button" onClick={() => handleStage()} className="rounded p-0.5 hover:bg-white/5">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {modified.map((f) => (
              <div key={f} className="group flex items-center gap-1 px-3 py-0.5 hover:bg-white/5">
                <span className="w-4 text-center font-bold text-blue-400">M</span>
                <button type="button" onClick={() => handleViewDiff(f)} className="flex-1 truncate text-left text-zinc-300 hover:text-white">
                  {f}
                </button>
                <button type="button" onClick={() => handleStage([f])} className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100">
                  <Plus className="h-3 w-3 text-zinc-500" />
                </button>
              </div>
            ))}
            {untracked.map((f) => (
              <div key={f} className="group flex items-center gap-1 px-3 py-0.5 hover:bg-white/5">
                <span className="w-4 text-center font-bold text-zinc-500">U</span>
                <button type="button" onClick={() => handleStage([f])} className="flex-1 truncate text-left text-zinc-300 hover:text-white">
                  {f}
                </button>
                <button type="button" onClick={() => handleStage([f])} className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100">
                  <Plus className="h-3 w-3 text-zinc-500" />
                </button>
              </div>
            ))}
            {deleted.map((f) => (
              <div key={f} className="group flex items-center gap-1 px-3 py-0.5 hover:bg-white/5">
                <span className="w-4 text-center font-bold text-red-400">D</span>
                <span className="flex-1 truncate text-zinc-500 line-through">{f}</span>
                <button type="button" onClick={() => handleStage([f])} className="rounded p-0.5 opacity-0 hover:bg-white/10 group-hover:opacity-100">
                  <Plus className="h-3 w-3 text-zinc-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Commit Box */}
        <div className="border-b border-white/5 p-3">
          <textarea
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') handleCommit(); }}
            placeholder="Commit message..."
            className="w-full resize-none rounded bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-purple-500/50"
            rows={2}
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCommit}
              disabled={!commitMsg.trim() || staged.length === 0}
              className="rounded bg-purple-600 px-3 py-1 text-white transition hover:bg-purple-500 disabled:opacity-40"
            >
              Commit
            </button>
            <button type="button" onClick={handlePush} className="flex items-center gap-1 rounded px-2 py-1 text-zinc-400 hover:bg-white/5">
              <Upload className="h-3 w-3" /> Push
            </button>
            <button type="button" onClick={handlePull} className="flex items-center gap-1 rounded px-2 py-1 text-zinc-400 hover:bg-white/5">
              <Download className="h-3 w-3" /> Pull
            </button>
          </div>
          {actionMsg && <p className="mt-1 text-[10px] text-zinc-500">{actionMsg}</p>}
        </div>

        {/* Commit History */}
        <div className="py-1">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex w-full items-center gap-1 px-3 py-1 text-zinc-400 hover:text-zinc-300"
          >
            {showHistory ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            History ({commits.length})
          </button>
          {showHistory && commits.map((c) => (
            <div key={c.hash} className="px-3 py-1 hover:bg-white/5">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-yellow-400">{c.short_hash}</span>
                <span className="flex-1 truncate text-zinc-300">{c.message}</span>
              </div>
              <div className="text-[10px] text-zinc-600">{c.author} &middot; {c.date}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
