'use client';

import { useCallback, useRef, useState } from 'react';
import { haptic } from '@/hooks/use-haptic';

type PullRefreshOptions = {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
};

export function usePullRefresh(options: PullRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef(0);
  const threshold = options.threshold ?? 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) {
      setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
      if (dy * 0.5 >= threshold) haptic.light();
    }
  }, [pulling, refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      haptic.medium();
      await options.onRefresh();
      setRefreshing(false);
    }
    setPullDistance(0);
    setPulling(false);
  }, [pullDistance, threshold, refreshing, options]);

  return {
    pullDistance,
    refreshing,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
