'use client';

import { useEffect, useState } from 'react';

import { TrustPanel } from '@/components/panels/trust-panel';
import { fetchCompanionTrust } from '@/lib/api';
import type { CompanionTrustSnapshot } from '@/lib/types';

export default function TrustPage() {
  const [snapshot, setSnapshot] = useState<CompanionTrustSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetchCompanionTrust();
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

  return <TrustPanel snapshot={snapshot} />;
}
