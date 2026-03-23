'use client';

import { create } from 'zustand';

export type GitFileStatus = {
  path: string;
  status: 'modified' | 'staged' | 'untracked' | 'deleted';
};

export type GitCommit = {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
};

export type DiffHunk = {
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: { type: 'added' | 'removed' | 'context'; content: string }[];
};

type GitStoreState = {
  isOpen: boolean;
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
  deleted: string[];
  commits: GitCommit[];
  loading: boolean;
  repoPath: string;
  toggleGit: () => void;
  setOpen: (open: boolean) => void;
  setRepoPath: (path: string) => void;
  setStatus: (data: {
    branch: string;
    ahead: number;
    behind: number;
    modified: string[];
    staged: string[];
    untracked: string[];
    deleted: string[];
  }) => void;
  setCommits: (commits: GitCommit[]) => void;
  setLoading: (loading: boolean) => void;
};

export const useGitStore = create<GitStoreState>()((set) => ({
  isOpen: false,
  branch: 'main',
  ahead: 0,
  behind: 0,
  modified: [],
  staged: [],
  untracked: [],
  deleted: [],
  commits: [],
  loading: false,
  repoPath: '/Users/user_pc/Projetos/aura_v1',

  toggleGit: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setRepoPath: (path) => set({ repoPath: path }),
  setStatus: (data) => set(data),
  setCommits: (commits) => set({ commits }),
  setLoading: (loading) => set({ loading }),
}));
