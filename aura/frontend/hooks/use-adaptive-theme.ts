'use client';

import { useEffect, useState } from 'react';

function isNightHour(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 6;
}

export function useAdaptiveTheme() {
  const [nightMode, setNightMode] = useState(false);
  const [userDisabled, setUserDisabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('aura_night_mode_disabled') === 'true';
    setUserDisabled(stored);
  }, []);

  useEffect(() => {
    const check = () => {
      const shouldBeNight = isNightHour() && !userDisabled;
      setNightMode(shouldBeNight);
    };
    check();
    const interval = setInterval(check, 60000);
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
