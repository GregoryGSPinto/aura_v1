'use client';

import { useEffect, useState } from 'react';

import { MemoryPanel } from '@/components/panels/memory-panel';
import { fetchCompanionMemory } from '@/lib/api';
import type { CompanionMemorySnapshot } from '@/lib/types';

export default function MemoryPage() {
  const [snapshot, setSnapshot] = useState<CompanionMemorySnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetchCompanionMemory();
        if (!mounted) return;
        setSnapshot(response.data);
      } catch {
        if (!mounted) return;
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return <MemoryPanel snapshot={snapshot} />;
}
