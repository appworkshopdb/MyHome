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
        <div className="sa-wlist">
          {display.map((log) => (
            <div key={log.id} className="sa-wr">
              <div className="sa-wbody">
                <div className="sa-wv">{Number(log.weight).toFixed(1)} kg</div>
                <div className="sa-wd">
                  {new Date(`${log.logged_on}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  {log.delta !== null && (
                    <span className="sa-delta" style={{ color: deltaColor(log.delta, goal) }}>
                      {formatDelta(log.delta)} zum vorherigen Eintrag
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
