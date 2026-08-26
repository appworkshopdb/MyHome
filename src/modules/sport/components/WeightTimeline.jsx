import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { getBodyProfile } from '../../../core/lib/bodyProfileData';
import { getWeightLogs, addWeightLog, deleteWeightLog } from '../../../core/lib/bodyWeightData';
import { IconTrash } from '../../../core/components/Icons';

const TODAY = () => new Date().toISOString().slice(0, 10);

// + und - bedeuten je nach Ziel etwas anderes: bei "Abnehmen" ist ein
// Minus der Erfolg (grün), bei "Zunehmen"/"Muskelaufbau" ein Plus.
// "Halten" bewertet beide Richtungen neutral. Nutzt die bestehenden
// Signalfarben (--success/--danger) statt neue Farben zu erfinden —
// Design-Regel "ein Akzent pro Ansicht, sonst nichts Buntes außer den
// funktionalen Signalfarben".
function deltaColor(delta, goal) {
  if (delta === 0 || !goal || goal === 'halten') return 'var(--text-primary)';
  const gainIsGood = goal === 'zunehmen' || goal === 'muskel';
  const isGain = delta > 0;
  const good = gainIsGood ? isGain : !isGain;
  return good ? 'var(--success)' : 'var(--danger)';
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
    return <div className="card">Lädt…</div>;
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
    <div className="card">
      <div className="card-title">Gewichtsverlauf</div>

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
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={() => { setDate(TODAY()); setShowForm(true); }}>
          + Gewicht eintragen
        </button>
      )}

      {display.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Noch kein Gewicht eingetragen.</p>
      ) : (
        display.map((log, i) => {
          const isLast = i === display.length - 1;
          return (
            <div key={log.id} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', marginTop: 4 }} />
                {!isLast && <div style={{ flex: 1, width: 2, background: 'var(--border)' }} />}
              </div>
              <div style={{ flex: 1, paddingBottom: 16, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{Number(log.weight).toFixed(1)} kg</span>
                  <button className="btn btn-secondary" onClick={() => handleDelete(log.id)} aria-label="Löschen" style={{ padding: '2px 8px' }}>
                    <IconTrash />
                  </button>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {new Date(`${log.logged_on}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
                {log.delta !== null && (
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: deltaColor(log.delta, goal), marginTop: 2 }}>
                    {formatDelta(log.delta)} zum vorherigen Eintrag
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
