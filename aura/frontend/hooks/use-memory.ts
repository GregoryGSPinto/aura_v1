'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MemoryPreference, MemoryProject, LongMemory } from '@/lib/types';
import {
  fetchMemoryPreferences,
  updateMemoryPreference,
  deleteMemoryPreference,
  fetchMemoryProjects,
  fetchMemoryProject,
  updateMemoryProject,
  fetchLongMemories,
  addLongMemory,
  deleteLongMemory,
  fetchMemoryContext,
} from '@/lib/api';

export function useMemory() {
  const [preferences, setPreferences] = useState<MemoryPreference[]>([]);
  const [projects, setProjects] = useState<MemoryProject[]>([]);
  const [longMemories, setLongMemories] = useState<LongMemory[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPreferences = useCallback(async (category?: string) => {
    try {
      const res = await fetchMemoryPreferences(category);
      if (res.success) setPreferences(res.data);
      return res.data;
    } catch {
      return [];
    }
  }, []);

  const setPreference = useCallback(async (key: string, category: string, value: string) => {
    try {
      const res = await updateMemoryPreference(key, category, value);
      if (res.success) {
        setPreferences((prev) => {
          const idx = prev.findIndex((p) => p.key === key);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data;
            return next;
          }
          return [...prev, res.data];
        });
      }
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const removePreference = useCallback(async (key: string) => {
    try {
      await deleteMemoryPreference(key);
      setPreferences((prev) => prev.filter((p) => p.key !== key));
    } catch { /* silent */ }
  }, []);

  const loadProjects = useCallback(async (status?: string) => {
    try {
      const res = await fetchMemoryProjects(status);
      if (res.success) setProjects(res.data);
      return res.data;
    } catch {
      return [];
    }
  }, []);

  const getProject = useCallback(async (slug: string) => {
    try {
      const res = await fetchMemoryProject(slug);
      return res.success ? res.data : null;
    } catch {
      return null;
    }
  }, []);

  const editProject = useCallback(async (slug: string, data: Partial<MemoryProject>) => {
    try {
      const res = await updateMemoryProject(slug, data);
      if (res.success) {
        setProjects((prev) => prev.map((p) => (p.slug === slug ? res.data : p)));
      }
      return res.success ? res.data : null;
    } catch {
      return null;
    }
  }, []);

  const loadLongMemories = useCallback(async (params?: { category?: string; project?: string; limit?: number }) => {
    try {
      const res = await fetchLongMemories(params);
      if (res.success) setLongMemories(res.data);
      return res.data;
    } catch {
      return [];
    }
  }, []);

  const saveLongMemory = useCallback(async (category: string, content: string, projectSlug?: string) => {
    try {
      const res = await addLongMemory({ category, content, project_slug: projectSlug });
      if (res.success) {
        setLongMemories((prev) => [res.data, ...prev]);
      }
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const removeLongMemory = useCallback(async (id: number) => {
    try {
      await deleteLongMemory(id);
      setLongMemories((prev) => prev.filter((m) => m.id !== id));
    } catch { /* silent */ }
  }, []);

  const getContext = useCallback(async (query: string, project?: string) => {
    try {
      const res = await fetchMemoryContext(query, project);
      return res.success ? res.data : [];
    } catch {
      return [];
    }
  }, []);

  // Load initial data
  useEffect(() => {
    setLoading(true);
    Promise.all([loadPreferences(), loadProjects(), loadLongMemories()])
      .finally(() => setLoading(false));
  }, [loadPreferences, loadProjects, loadLongMemories]);

  return {
    preferences,
    projects,
    longMemories,
    loading,
    loadPreferences,
    setPreference,
    removePreference,
    loadProjects,
    getProject,
    editProject,
    loadLongMemories,
    saveLongMemory,
    removeLongMemory,
    getContext,
  };
}
