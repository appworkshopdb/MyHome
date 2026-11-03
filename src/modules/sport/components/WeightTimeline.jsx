import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { getBodyProfile } from '../../../core/lib/bodyProfileData';
import { getWeightLogs, addWeightLog, deleteWeightLog } from '../../../core/lib/bodyWeightData';
import { IconTrash } from '../../../core/components/Icons';

const TODAY = () => new Date().toISOString().slice(0, 10);

// + und - bedeuten je nach Ziel etwas anderes:
//   Abnehmen          → Minus gut (grün), Plus schlecht (rot)
//   Zunehmen / Muskel → Plus gut (grün), Minus schlecht (rot)
//   Halten            → jede Veränderung schlecht (rot)
// Ohne Ziel oder bei ±0 bleibt die Angabe neutral. Nutzt die vorhandenen Signalfarben
// (--status-positive/--status-critical), Klassen .sa-delta--good|bad in design-v2.css.
function deltaTone(delta, goal) {
  if (!delta || !goal) return 'neutral';
  if (goal === 'halten') return 'bad';
  const gainIsGood = goal === 'zunehmen' || goal === 'muskel';
  if (goal !== 'abnehmen' && !gainIsGood) return 'neutral';
  return (gainIsGood ? delta > 0 : delta < 0) ? 'good' : 'bad';
}

function formatDelta(delta) {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return `${sign}${Math.abs(delta).toFixed(1)} kg`;
}

export default function WeightTimeline() {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [logs, setLogs] = useState([]);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(TODAY());
  const [weight, setWeight] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [weightLogs, profile] = await Promise.all([
        getWeightLogs(session),
        getBodyProfile(session),
      ]);
      setLogs(weightLogs);
      setGoal(profile.goal);
    } catch (e) {
      console.error(e);
      showToast('Gewichtsverlauf konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [session, showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    const value = parseFloat(weight.replace(',', '.'));
    if (isNaN(value) || value <= 20 || value >= 400) {
      return showToast('Bitte ein gültiges Gewicht eingeben (kg)');
    }
    try {
      await addWeightLog(session, { logged_on: date, weight: value });
      setShowForm(false);
      setWeight('');
      showToast('Gewicht eingetragen');
      await load();
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
    }
  }

  async function handleDelete(id) {
    try {
      await deleteWeightLog(session, id);
      await load();
    } catch (e) {
      console.error(e);
      showToast('Löschen fehlgeschlagen');
    }
  }

  if (loading) {
    return <div className="sa-card">Lädt…</div>;
  }

  // Deltas chronologisch (älteste zuerst) berechnen — "Vorher" muss der
  // zeitlich vorherige Eintrag sein, unabhängig von der Anzeige-
  // Reihenfolge. Danach für die Anzeige umdrehen (neuester zuerst).
  const withDelta = logs.map((log, i) => ({
    ...log,
    delta: i === 0 ? null : Number(log.weight) - Number(logs[i - 1].weight),
  }));
  const display = [...withDelta].reverse();

  return (
    <div className="sa-card">
      <div className="sa-ch">Gewichtsverlauf</div>

      {showForm ? (
        <div style={{ marginBottom: 12 }}>
          <div className="form-row">
            <div className="form-group">
              <label>Datum</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Gewicht (kg)</label>
              <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="z.B. 75,5" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={handleAdd}>Speichern</button>
          </div>
        </div>
      ) : (
        <button className="sa-wbtn" onClick={() => { setDate(TODAY()); setShowForm(true); }}>
          + Gewicht eintragen
        </button>
      )}

      {display.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', margin: '10px 0 0' }}>Noch kein Gewicht eingetragen.</p>
      ) : (
        <div className={`sa-wlist${display.length > 3 ? ' scroll' : ''}`}>
          {display.map((log, i) => (
            <div key={log.id} className="sa-wr">
              <div className="sa-rail" aria-hidden="true">
                <span className="sa-dot" />
                {i < display.length - 1 && <span className="sa-line" />}
              </div>
              <div className="sa-wbody">
                <div className="sa-wv">{Number(log.weight).toFixed(1)} kg</div>
                <div className="sa-wd">
                  {new Date(`${log.logged_on}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {log.delta !== null && (
                    <span className={`sa-delta sa-delta--${deltaTone(log.delta, goal)}`}>
                      {formatDelta(log.delta)}
                    </span>
                  )}
                </div>
              </div>
              <button className="sa-del" onClick={() => handleDelete(log.id)} aria-label="Löschen">
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
