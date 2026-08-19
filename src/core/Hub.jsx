import { useEffect, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { getMonthSum, getRecentMeasurements } from './lib/measurementsData';
import { formatEur, formatRelativeDate } from './lib/format';
import { MODULES, getModule } from './modules';

// Menschenlesbare Labels je metric_key. Bewusst hier zentral gepflegt,
// nicht pro Modul verstreut — neue Module tragen hier einfach ihre
// eigenen Keys nach, der Rest des Hubs muss nichts wissen.
const METRIC_LABELS = {
  'finance.income': 'Einnahme',
  'finance.expense': 'Ausgabe',
};

export default function Hub({ onOpenModule }) {
  const { session } = useAuth();
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [activity, setActivity] = useState([]);
  const [ladeVorgang, setLadeVorgang] = useState(true);

  useEffect(() => {
    let aktiv = true;
    async function load() {
      const now = new Date();
      try {
        const [inc, exp, recent] = await Promise.all([
          getMonthSum(session, 'finance.income', now.getFullYear(), now.getMonth() + 1),
          getMonthSum(session, 'finance.expense', now.getFullYear(), now.getMonth() + 1),
          getRecentMeasurements(session, 5),
        ]);
        if (!aktiv) return;
        setIncome(inc);
        setExpense(exp);
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

  const saldo = income - expense;
  const hatDaten = !ladeVorgang && activity.length > 0;
  const monatsname = new Date().toLocaleDateString('de-DE', { month: 'long' });
  // Modul mit der jüngsten Aktivität bekommt die invertierte Kachel —
  // kein erfundener "wichtigster" Wert, sondern das, was gerade lief.
  const hervorgehobenesModul = activity[0]?.source_module || 'finance';

  return (
    <div className="hub">
      {ladeVorgang && <div className="status-note">Wird geladen…</div>}

      {!ladeVorgang && !hatDaten && (
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

      {hatDaten && (
        <>
          <div className="hub-eyebrow">Saldo diesen Monat</div>
          <div className="hub-lead-stat">{formatEur(saldo)}</div>
          <div className="hub-lead-substats">
            <span>Ein <b>{formatEur(income)}</b></span>
            <span>Aus <b>{formatEur(expense)}</b></span>
          </div>
        </>
      )}

      <div className="hub-divider" />

      <div className="hub-module-grid">
        {MODULES.filter((m) => m.built).map((m) => {
          const invert = m.id === hervorgehobenesModul && hatDaten;
          return (
            <button
              key={m.id}
              className={`hub-module-cell ${invert ? 'invert' : ''}`}
              onClick={() => onOpenModule(m.id)}
            >
              <span className="hub-module-dot" style={{ background: invert ? 'currentColor' : m.color }} />
              <span>{m.name}</span>
            </button>
          );
        })}
      </div>

      {hatDaten && (
        <>
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
                  <div className={`hub-activity-value ${isIncome ? 'accent' : ''}`}>
                    {m.unit === 'EUR' ? formatEur(signedValue) : `${signedValue} ${m.unit}`}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
