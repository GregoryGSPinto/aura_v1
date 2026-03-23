'use client';

import { useCallback, useEffect, useState } from 'react';

type DeviceInfo = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isStandalone: boolean;
  hasTouchScreen: boolean;
  safeAreaInsets: { top: number; bottom: number; left: number; right: number };
  orientation: 'portrait' | 'landscape';
  keyboardVisible: boolean;
};

export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isStandalone: false,
    hasTouchScreen: false,
    safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
    orientation: 'portrait',
    keyboardVisible: false,
  }));

  const update = useCallback(() => {
    const w = window.innerWidth;
    const isMobile = w < 768;
    const isTablet = w >= 768 && w <= 1024;
    const isDesktop = w > 1024;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true);
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const orientation: 'portrait' | 'landscape' = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    // Keyboard detection via visualViewport
    let keyboardVisible = false;
    if (window.visualViewport) {
      const heightDiff = window.innerHeight - window.visualViewport.height;
      keyboardVisible = heightDiff > 150;
    }

    setInfo({
      isMobile,
      isTablet,
      isDesktop,
      isStandalone,
      hasTouchScreen,
      safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
      orientation,
      keyboardVisible,
    });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [update]);

  return info;
}
