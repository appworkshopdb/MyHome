import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { getMonthSum, getRecentMeasurements } from './lib/measurementsData';
import { formatEur, formatRelativeDate } from './lib/format';
import { getModule } from './modules';

// Menschenlesbare Labels je metric_key. Bewusst hier zentral gepflegt,
// nicht pro Modul verstreut — neue Module tragen hier einfach ihre
// eigenen Keys nach, der Rest des Hubs muss nichts wissen.
const METRIC_LABELS = {
  'finance.income': 'Einnahme',
  'finance.expense': 'Ausgabe',
};

const CACHE_KEY = 'hub-cache-v1';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() })); } catch { /* egal */ }
}

// Zustandsmodell statt nur ladeVorgang/hatDaten — ein Netzfehler soll
// sich NIE wie "Monat ist leer" lesen (das wäre gelogen), und ein
// abgelaufenes Token soll NIE eine harte Login-Wand sein, wenn wir noch
// den letzten bekannten Stand zeigen können.
//   'laedt'    — Skeleton in Endform-Maßen, kein Text, kein Sprung
//   'fehler'   — eigener Bildschirm, klar als Störung erkennbar
//   'veraltet' — letzter bekannter Stand, aber sichtbar nicht frisch
//   'leer'     — ehrlich: noch keine Daten, drei Wege raus
//   'daten'    — der gefüllte Hub
export default function Hub({ onOpenModule }) {
  const { session } = useAuth();
  const [status, setStatus] = useState('laedt');
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [activity, setActivity] = useState([]);
  const [cacheZeit, setCacheZeit] = useState(null);

  const load = useCallback(async () => {
    setStatus('laedt');
    const now = new Date();
    try {
      const [inc, exp, recent] = await Promise.all([
        getMonthSum(session, 'finance.income', now.getFullYear(), now.getMonth() + 1),
        getMonthSum(session, 'finance.expense', now.getFullYear(), now.getMonth() + 1),
        getRecentMeasurements(session, 5),
      ]);
      setIncome(inc);
      setExpense(exp);
      setActivity(recent);
      writeCache({ income: inc, expense: exp, activity: recent });
      setStatus(recent.length > 0 || inc > 0 || exp > 0 ? 'daten' : 'leer');
    } catch (e) {
      console.error('[Hub] Laden fehlgeschlagen:', e);
      setStatus('fehler');
    }
  }, [session]);

  useEffect(() => {
    let aktiv = true;
    load().catch(() => { if (aktiv) setStatus('fehler'); });
    return () => { aktiv = false; };
  }, [load]);

  function letztenStandAnsehen() {
    const cached = readCache();
    if (!cached) return;
    setIncome(cached.income);
    setExpense(cached.expense);
    setActivity(cached.activity);
    setCacheZeit(cached.savedAt);
    setStatus('veraltet');
  }

  const saldo = income - expense;
  const monatsname = new Date().toLocaleDateString('de-DE', { month: 'long' });

  if (status === 'laedt') {
    return (
      <div className="hub">
        <div className="hub-skeleton-block" style={{ width: 112, height: 9 }} />
        <div className="hub-skeleton-block" style={{ width: 212, height: 38, marginTop: 8 }} />
        <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
          <div className="hub-skeleton-block" style={{ width: 96, height: 11 }} />
          <div className="hub-skeleton-block" style={{ width: 96, height: 11 }} />
        </div>
        <div className="hub-skeleton-block" style={{ width: '100%', height: 10, marginTop: 14 }} />
        <div className="hub-skeleton-block" style={{ width: 78, height: 10, marginTop: 24 }} />
        {[0, 1].map((i) => (
          <div key={i} className="hub-skeleton-row">
            <div>
              <div className="hub-skeleton-block" style={{ width: 124, height: 11 }} />
              <div className="hub-skeleton-block" style={{ width: 80, height: 9, marginTop: 6 }} />
            </div>
            <div className="hub-skeleton-block" style={{ width: 62, height: 11 }} />
          </div>
        ))}
      </div>
    );
  }

  if (status === 'fehler') {
    return (
      <div className="hub">
        <div className="hub-error">
          <div className="hub-error-headline">{monatsname} lässt sich gerade nicht laden.</div>
          <p className="hub-error-sub">Keine Verbindung zur Datenbank. Deine Daten sind da — sie kommen hier nur nicht an.</p>
          <div className="auth-actions" style={{ marginTop: 20 }}>
            <button className="btn btn-primary btn-block" onClick={load}>Nochmal versuchen</button>
            {readCache() && (
              <button className="btn-outline-block" onClick={letztenStandAnsehen}>Letzten Stand ansehen</button>
            )}
          </div>
          <div className="hub-empty-note" style={{ marginTop: 18 }}>
            Liegt's am Gerät? Prüf kurz die Internetverbindung — an den Daten selbst hat sich nichts geändert.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hub">
      {status === 'veraltet' && (
        <div className="hub-stale-bar">
          <span className="hub-stale-dot" />
          <span>Stand von {cacheZeit ? new Date(cacheZeit).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'} — Sitzung abgelaufen</span>
          <button className="hub-stale-login" onClick={() => window.location.reload()}>Anmelden</button>
        </div>
      )}

      {status === 'leer' && (
        <>
          <div className="hub-empty-headline">{monatsname} ist noch leer.</div>
          <p className="hub-empty-sub">Trag eine Ausgabe ein — den Rest baut die App daraus. Zwei Sekunden, kein Formular.</p>

          <div className="hub-empty-steps">
            <button className="hub-empty-step" onClick={() => onOpenModule('finance')}>
              <div>
                <div className="hub-empty-step-title">Erste Ausgabe eintragen</div>
                <div className="hub-empty-step-sub">Betrag, Name, fertig</div>
              </div>
              <span className="hub-empty-step-arrow">›</span>
            </button>
            <button className="hub-empty-step" onClick={() => onOpenModule('finance')}>
              <div>
                <div className="hub-empty-step-title">Fixkosten anlegen</div>
                <div className="hub-empty-step-sub">Miete, Handy, Abos — einmal, dann jeden Monat automatisch</div>
              </div>
              <span className="hub-empty-step-arrow">›</span>
            </button>
            <button className="hub-empty-step" onClick={() => onOpenModule('finance')}>
              <div>
                <div className="hub-empty-step-title">Alte Daten importieren</div>
                <div className="hub-empty-step-sub">JSON oder XLSX</div>
              </div>
              <span className="hub-empty-step-arrow" style={{ color: 'var(--text-muted)' }}>›</span>
            </button>
          </div>

          <div className="hub-empty-note">
            <b>Warum leer und nicht Beispieldaten:</b> geschönte Zahlen fühlen sich beim ersten Löschen wie Arbeit an. Drei Wege raus sind ehrlicher.
          </div>
        </>
      )}

      {(status === 'daten' || status === 'veraltet') && (
        <>
          <div className="hub-eyebrow">Saldo diesen Monat</div>
          <div className="hub-lead-stat" style={{ color: status === 'veraltet' ? 'var(--text-secondary)' : undefined }}>
            {formatEur(saldo)}
          </div>
          <div className="hub-lead-substats" style={{ color: status === 'veraltet' ? 'var(--text-muted)' : undefined }}>
            <span>Ein <b style={status === 'veraltet' ? { color: 'var(--text-secondary)' } : undefined}>{formatEur(income)}</b></span>
            <span>Aus <b style={status === 'veraltet' ? { color: 'var(--text-secondary)' } : undefined}>{formatEur(expense)}</b></span>
          </div>

          <div className="hub-divider" />

          <div className="hub-section-label">Aktivität</div>
          <div className="hub-activity-list">
            {activity.map((m) => {
              const mod = getModule(m.source_module);
              const isIncome = m.metric_key.endsWith('.income');
              const signedValue = m.metric_key.endsWith('.expense') ? -Math.abs(m.value) : m.value;
              return (
                <div className="hub-activity-row" key={m.id}>
                  <div>
                    <div className="hub-activity-title">{METRIC_LABELS[m.metric_key] || m.metric_key}</div>
                    <div className="hub-activity-time">{mod?.name || m.source_module} · {formatRelativeDate(m.created_at)}</div>
                  </div>
                  <div className="hub-activity-value">
                    {isIncome && <span className="hub-activity-value-dot" />}
                    {m.unit === 'EUR' ? formatEur(signedValue) : `${signedValue} ${m.unit}`}
                  </div>
                </div>
              );
            })}
            {activity.length === 0 && <div className="fin-row-empty">Noch keine Aktivität.</div>}
          </div>
        </>
      )}
    </div>
  );
}
