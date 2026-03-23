'use client';

import { useEffect, useState } from 'react';

function isNightHour(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
}

export function useAdaptiveTheme() {
  const [nightMode, setNightMode] = useState(false);
  const [userDisabled, setUserDisabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('aura_night_mode_disabled') === 'true';
  });

  useEffect(() => {
    const check = () => {
      const shouldBeNight = isNightHour() && !userDisabled;
      setNightMode(shouldBeNight);
    };
    check();
    const interval = setInterval(check, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [userDisabled]);

  useEffect(() => {
    if (nightMode) {
      document.documentElement.classList.add('night-mode');
    } else {
      document.documentElement.classList.remove('night-mode');
    }
  }, [nightMode]);

  const toggleNightMode = () => {
    const next = !userDisabled;
    setUserDisabled(next);
    localStorage.setItem('aura_night_mode_disabled', String(next));
  };

  return { nightMode, userDisabled, toggleNightMode };
}
