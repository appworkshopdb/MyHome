import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadStoredSession, refreshSession, signOut, REFRESH_MARGIN_MS } from './rawAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  const timerRef = useRef(null);

  // Initiales Laden der gespeicherten Sitzung (einmalig beim App-Start).
  useEffect(() => {
    setSession(loadStoredSession());
    setLadeVorgang(false);
  }, []);

  // Automatisches Token-Refresh: läuft immer wieder neu an, sobald sich
  // die Session ändert (Login, Refresh, Logout) — so bleibt der Timer
  // immer mit dem aktuell gültigen Token synchron.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!session?.refresh_token || !session?.expires_at) return;

    // War der Tab lange im Hintergrund / Rechner im Standby und das Token
    // ist schon (fast) abgelaufen, wird sofort erneuert statt zu warten —
    // das ersetzt den bisherigen "nach 1h manuell neu einloggen"-Zustand.
    const delay = Math.max(session.expires_at - Date.now() - REFRESH_MARGIN_MS, 0);

    timerRef.current = setTimeout(async () => {
      try {
        const erneuert = await refreshSession(session.refresh_token);
        setSession(erneuert); // triggert diesen Effect erneut -> nächster Timer
      } catch (err) {
        // refresh_token ungültig/abgelaufen (z.B. nach sehr langer
        // Inaktivität, oder wurde in Supabase widerrufen) -> ausloggen,
        // Person landet wieder auf dem Login-Screen.
        console.warn('[Auth] Token-Refresh fehlgeschlagen, melde ab:', err.message);
        signOut();
        setSession(null);
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, ladeVorgang, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
