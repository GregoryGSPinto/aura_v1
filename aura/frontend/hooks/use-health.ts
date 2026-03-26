'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchHealthStatus, fetchDoctor } from '@/lib/api';

export interface ServiceHealth {
  name: string;
  status: string;
  latency_ms: number | null;
  last_check: string;
  last_error: string | null;
  action: string | null;
  extra: Record<string, unknown>;
}

export interface HealthState {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'loading' | 'unreachable';
  services: Record<string, ServiceHealth>;
  uptimeSeconds: number;
  timestamp: string | null;
  isLoading: boolean;
  lastCheck: Date | null;
}

const POLL_INTERVAL = 30_000; // 30 seconds

export function useHealth() {
  const [state, setState] = useState<HealthState>({
    overallStatus: 'loading',
    services: {},
    uptimeSeconds: 0,
    timestamp: null,
    isLoading: true,
    lastCheck: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refetch = useCallback(async () => {
    try {
      const response = await fetchHealthStatus();
      const data = response.data;
      setState({
        overallStatus: data.status as HealthState['overallStatus'],
        services: data.services ?? {},
        uptimeSeconds: data.uptime_seconds ?? 0,
        timestamp: data.timestamp ?? null,
        isLoading: false,
        lastCheck: new Date(),
      });
    } catch {
      setState((prev) => ({
        ...prev,
        overallStatus: 'unreachable',
        isLoading: false,
        lastCheck: new Date(),
      }));
    }
  }, []);

  const runDoctor = useCallback(async () => {
    try {
      const response = await fetchDoctor();
      return response.data;
    } catch (err) {
      return { status: 'error', error: String(err) };
    }
  }, []);

  useEffect(() => {
    void refetch();
    timerRef.current = setInterval(() => {
      void refetch();
    }, POLL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refetch]);

  return { ...state, refetch, runDoctor };
}
