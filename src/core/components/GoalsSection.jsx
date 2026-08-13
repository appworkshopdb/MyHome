import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { getGoals, saveGoal, deleteGoal, toggleMilestone } from '../lib/goalsData';
import { IconClose } from './Icons';

const EMPTY_FORM = { title: '', target_value: '', unit: '', target_date: '', milestones: [] };

// Ziele-Sektion für genau EIN Modul (sourceModule). Jedes Modul bindet
// diese Komponente mit seiner eigenen Kennung ein — core/Profile.jsx
// selbst legt keine Ziele an, sondern zeigt nur eine Vorschau über alle
// Module hinweg (liest dieselbe goals-Tabelle, ungefiltert).
export default function GoalsSection({ sourceModule }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGoals(await getGoals(session, sourceModule));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [session, sourceModule]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm({ ...EMPTY_FORM }); }

  function addMilestoneField() {
    setForm((f) => ({ ...f, milestones: [...f.milestones, { label: '', done: false }] }));
  }
  function setMilestoneLabel(i, label) {
    setForm((f) => ({ ...f, milestones: f.milestones.map((m, idx) => (idx === i ? { ...m, label } : m)) }));
  }
  function removeMilestoneField(i) {
    setForm((f) => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }));
  }

  async function submit() {
    if (!form.title.trim()) return;
    try {
      await saveGoal(session, {
        source_module: sourceModule,
        title: form.title.trim(),
        target_value: form.target_value === '' ? null : Number(form.target_value),
        unit: form.unit.trim() || null,
        target_date: form.target_date || null,
        milestones: form.milestones.filter((m) => m.label.trim()),
      });
      setForm(null);
      showToast('Ziel gespeichert');
      load();
    } catch (e) {
      showToast('Ziel konnte nicht gespeichert werden');
      console.error(e);
    }
  }

  async function remove(id) {
    if (!confirm('Ziel löschen?')) return;
    await deleteGoal(id);
    load();
  }

  async function flipMilestone(goal, i) {
    await toggleMilestone(session, goal, i);
    load();
  }

  return (
    <div className="card">
      <div className="card-title">Ziele</div>

      {!loading && goals.length === 0 && !form && (
        <div className="status-note" style={{ marginBottom: 12 }}>Noch keine Ziele für dieses Modul.</div>
      )}

      {goals.map((g) => (
        <div className="goal-row" key={g.id}>
          <div className="goal-row-header">
            <span className="goal-title">{g.title}</span>
            <button className="goal-delete" onClick={() => remove(g.id)} aria-label="Ziel löschen"><IconClose /></button>
          </div>
          {(g.target_value != null || g.target_date) && (
            <div className="goal-meta">
              {g.target_value != null ? `Ziel: ${g.target_value}${g.unit ? ' ' + g.unit : ''}` : ''}
              {g.target_date ? `${g.target_value != null ? ' · ' : ''}bis ${new Date(g.target_date).toLocaleDateString('de-DE')}` : ''}
            </div>
          )}
          {g.milestones?.length > 0 && (
            <div className="goal-milestones">
              {g.milestones.map((m, i) => (
                <label className="goal-milestone" key={i}>
                  <input type="checkbox" checked={!!m.done} onChange={() => flipMilestone(g, i)} />
                  <span style={{ textDecoration: m.done ? 'line-through' : 'none', color: m.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {m.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {form ? (
        <div style={{ marginTop: goals.length > 0 ? 14 : 0 }}>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label>Titel</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. 500 € Rücklage" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group">
              <label>Zielwert (optional)</label>
              <input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Einheit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="€, kg, …" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Zieldatum (optional)</label>
            <input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
          </div>

          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Meilensteine</label>
          {form.milestones.map((m, i) => (
            <div className="goal-form-milestone-row" key={i}>
              <input value={m.label} onChange={(e) => setMilestoneLabel(i, e.target.value)} placeholder={`Meilenstein ${i + 1}`} />
              <button className="goal-form-milestone-remove" onClick={() => removeMilestoneField(i)} aria-label="Meilenstein entfernen"><IconClose /></button>
            </div>
          ))}
          <button className="btn btn-secondary" style={{ marginBottom: 14 }} onClick={addMilestoneField}>+ Meilenstein</button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={submit}>Speichern</button>
            <button className="btn btn-secondary" onClick={() => setForm(null)}>Abbrechen</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={openNew} style={{ marginTop: goals.length > 0 ? 12 : 0 }}>+ Ziel</button>
      )}
    </div>
  );
}
