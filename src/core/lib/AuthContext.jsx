import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadStoredSession, consumeAuthRedirect, refreshSession, signOut, REFRESH_MARGIN_MS } from './rawAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ladeVorgang, setLadeVorgang] = useState(true);
  // Hinweis nach Rückkehr aus der Bestätigungsmail (z. B. Link abgelaufen);
  // Login.jsx zeigt ihn an.
  const [authNotice, setAuthNotice] = useState(null);
  // true, solange die Person über den „Passwort vergessen“-Link kommt und noch
  // kein neues Passwort gesetzt hat (App.jsx zeigt dann ResetPassword).
  const [recovery, setRecovery] = useState(false);
  // true, wenn diese Seite über den Link aus der Bestätigungsmail geöffnet wurde
  // (z. B. im Browser, obwohl die Registrierung in der installierten App begann);
  // der Registrierungs-Wizard zeigt dann einen Hinweis zum Zurückwechseln.
  const [confirmedViaLink, setConfirmedViaLink] = useState(false);
  const timerRef = useRef(null);

  // Initiales Laden der gespeicherten Sitzung (einmalig beim App-Start).
  // Kommt die Person über den Link aus der Bestätigungsmail zurück, steht
  // die Sitzung noch nicht im Speicher — consumeAuthRedirect() legt sie an
  // (und landet damit direkt im Onboarding statt auf dem Login).
  useEffect(() => {
    let aktiv = true;
    (async () => {
      const redirect = await consumeAuthRedirect();
      if (!aktiv) return;
      if (redirect?.error) setAuthNotice(redirect.error);
      if (redirect?.session && redirect.type === 'recovery') setRecovery(true);
      if (redirect?.session && redirect.type === 'signup') setConfirmedViaLink(true);
      setSession(redirect?.session ?? loadStoredSession());
      setLadeVorgang(false);
    })();
    return () => { aktiv = false; };
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
    <AuthContext.Provider value={{ session, ladeVorgang, setSession, authNotice, clearAuthNotice: () => setAuthNotice(null), recovery, clearRecovery: () => setRecovery(false), confirmedViaLink }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
