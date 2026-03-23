'use client';

import { useEffect, useRef } from 'react';

type SwipeOptions = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
};

export function useSwipe(ref: React.RefObject<HTMLElement | null>, options: SwipeOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const threshold = options.threshold ?? 50;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!startRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      startRef.current = null;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > absDy && absDx > threshold) {
        if (dx > 0) options.onSwipeRight?.();
        else options.onSwipeLeft?.();
      } else if (absDy > absDx && absDy > threshold) {
        if (dy > 0) options.onSwipeDown?.();
        else options.onSwipeUp?.();
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, options.onSwipeLeft, options.onSwipeRight, options.onSwipeUp, options.onSwipeDown, threshold]);
}
