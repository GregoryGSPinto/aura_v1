'use client';

import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'laptop' | 'desktop';

const BREAKPOINTS = {
  tablet: '(min-width: 640px)',
  laptop: '(min-width: 1024px)',
  desktop: '(min-width: 1280px)',
} as const;

/**
 * Returns the current responsive breakpoint.
 * Uses window.matchMedia — no resize event listeners.
 *
 * mobile:  0 – 639px
 * tablet:  640 – 1023px
 * laptop:  1024 – 1279px
 * desktop: 1280px+
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const queries = {
      tablet: window.matchMedia(BREAKPOINTS.tablet),
      laptop: window.matchMedia(BREAKPOINTS.laptop),
      desktop: window.matchMedia(BREAKPOINTS.desktop),
    };

    const update = () => {
      if (queries.desktop.matches) setBreakpoint('desktop');
      else if (queries.laptop.matches) setBreakpoint('laptop');
      else if (queries.tablet.matches) setBreakpoint('tablet');
      else setBreakpoint('mobile');
    };

    update();

    Object.values(queries).forEach((mq) => mq.addEventListener('change', update));
    return () => {
      Object.values(queries).forEach((mq) => mq.removeEventListener('change', update));
    };
  }, []);

  return breakpoint;
}
