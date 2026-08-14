import { useEffect, useState } from 'react';
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

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export default function Hub({ onOpenModule }) {
  const { session } = useAuth();
  const [saldo, setSaldo] = useState(null);
  const [activity, setActivity] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);

  useEffect(() => {
    let aktiv = true;
    async function load() {
      const now = new Date();
      try {
        const [income, expense, recent] = await Promise.all([
          getMonthSum(session, 'finance.income', now.getFullYear(), now.getMonth() + 1),
          getMonthSum(session, 'finance.expense', now.getFullYear(), now.getMonth() + 1),
          getRecentMeasurements(session, 5),
        ]);
        if (!aktiv) return;
        setSaldo(income - expense);
        setActivity(recent);
      } catch (e) {
        console.error('[Hub] Laden fehlgeschlagen:', e);
      } finally {
        if (aktiv) setLadeVorgang(false);
      }
    }
    load();
    return () => { aktiv = false; };
  }, [session]);

  const name = session.user.email.split('@')[0];
  const heute = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="hub">
      <div className="page-header">
        <h1>{greeting()}, {name}</h1>
        <p style={{ marginTop: 2 }}>{heute}</p>
      </div>

      {!ladeVorgang && saldo !== null && (
        <div className="card hub-stat-card">
          <div className="hub-stat-label">Diesen Monat</div>
          <div className="hub-stat-value">{formatEur(saldo)}</div>
          <button
            className="hub-module-pill"
            style={{ '--pill-color': getModule('finance').color }}
            onClick={() => onOpenModule('finance')}
          >
            <span className="hub-module-dot" />
            Finanzen
          </button>
        </div>
      )}

      <div className="hub-activity-label">Letzte Aktivität</div>
      <div className="card hub-activity-card">
        {ladeVorgang && <div className="status-note">Wird geladen…</div>}
        {!ladeVorgang && activity.length === 0 && (
          <div className="status-note">Noch keine Einträge — leg los, sobald ein Modul offen ist.</div>
        )}
        {activity.map((m, i) => {
          const mod = getModule(m.source_module);
          const signedValue = m.metric_key.endsWith('.expense') ? -Math.abs(m.value) : m.value;
          return (
            <div className="hub-activity-row" key={m.id} style={{ borderBottom: i === activity.length - 1 ? 'none' : undefined }}>
              <div className="hub-activity-left">
                <span className="hub-module-dot" style={{ background: mod?.color || 'var(--text-muted)' }} />
                <div>
                  <div className="hub-activity-title">{METRIC_LABELS[m.metric_key] || m.metric_key}</div>
                  <div className="hub-activity-time">{mod?.name || m.source_module} · {formatRelativeDate(m.created_at)}</div>
                </div>
              </div>
              <div className="hub-activity-value">{m.unit === 'EUR' ? formatEur(signedValue) : `${signedValue} ${m.unit}`}</div>
            </div>
          );
        })}
      </div>

      <div className="hub-hint">Weitere Module erscheinen hier automatisch, sobald sie gebaut sind.</div>
    </div>
  );
}
