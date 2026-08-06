import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { applyTheme, getThemePref } from './theme';

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const initial = getThemePref();
  const [mode, setModeState] = useState(initial.mode);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  // Systemwechsel beachten, solange Modus auf „System" steht
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (mode === 'auto') applyTheme(mode); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = useCallback((m) => {
    localStorage.setItem('mode', m);
    setModeState(m);
  }, []);

  const showToast = useCallback((msg, duration = 2200) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), duration);
  }, []);

  return (
    <UiContext.Provider value={{ mode, setMode, showToast }}>
      {children}
      <div className={`toast ${toast ? 'show' : ''}`}>{toast || ''}</div>
    </UiContext.Provider>
  );
}

export function useUi() {
  return useContext(UiContext);
}
