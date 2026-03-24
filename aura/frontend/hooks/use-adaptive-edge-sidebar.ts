'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type AdaptiveEdgeSidebarOptions = {
  collapsed: boolean;
  defaultCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  minWidth?: number;
  closeDelayMs?: number;
};

type HoverHandlers = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

type AdaptiveEdgeSidebarResult = {
  hoverMode: boolean;
  panelHandlers: HoverHandlers;
  hotspotHandlers: HoverHandlers;
  toggle: () => void;
};

export function useAdaptiveEdgeSidebar({
  collapsed,
  defaultCollapsed,
  onCollapsedChange,
  minWidth = 1024,
  closeDelayMs = 140,
}: AdaptiveEdgeSidebarOptions): AdaptiveEdgeSidebarResult {
  const closeTimerRef = useRef<number | null>(null);
  const [hoverMode, setHoverMode] = useState(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const open = useCallback(() => {
    clearCloseTimer();
    if (collapsed) onCollapsedChange(false);
  }, [clearCloseTimer, collapsed, onCollapsedChange]);

  const scheduleClose = useCallback(() => {
    if (!hoverMode) return;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      onCollapsedChange(true);
      closeTimerRef.current = null;
    }, closeDelayMs);
  }, [clearCloseTimer, closeDelayMs, hoverMode, onCollapsedChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(min-width: ${minWidth}px) and (hover: hover) and (pointer: fine)`);
    const updateHoverMode = () => {
      const nextHoverMode = mediaQuery.matches;
      setHoverMode(nextHoverMode);
      clearCloseTimer();
      if (nextHoverMode) {
        onCollapsedChange(defaultCollapsed);
      }
    };

    updateHoverMode();
    mediaQuery.addEventListener('change', updateHoverMode);

    return () => {
      clearCloseTimer();
      mediaQuery.removeEventListener('change', updateHoverMode);
    };
  }, [clearCloseTimer, defaultCollapsed, minWidth, onCollapsedChange]);

  const toggle = useCallback(() => {
    clearCloseTimer();
    onCollapsedChange(!collapsed);
  }, [clearCloseTimer, collapsed, onCollapsedChange]);

  const handlers = useMemo<HoverHandlers>(() => ({
    onMouseEnter: open,
    onMouseLeave: scheduleClose,
  }), [open, scheduleClose]);

  return {
    hoverMode,
    panelHandlers: handlers,
    hotspotHandlers: handlers,
    toggle,
  };
}
