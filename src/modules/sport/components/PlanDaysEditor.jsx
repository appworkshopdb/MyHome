import { resolveTypeLabel } from '../lib/typeLabel';
import { PREDEFINED_UNITS } from '../lib/data/predefinedUnits';

function isPredefinedId(id) {
  return typeof id === 'string' && id.startsWith('pre.');
}

function findAnyUnit(id, personalUnits) {
  if (isPredefinedId(id)) return PREDEFINED_UNITS.find((u) => u.key === id) ?? null;
  return personalUnits.find((u) => u.id === id) ?? null;
}

export default function PlanDaysEditor({ days, onChange, units = [] }) {
  function updateDay(index, patch) {
    onChange(days.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function handleUnitChange(index, unitId) {
    const unit = findAnyUnit(unitId, units);
    updateDay(index, {
      unit_id: isPredefinedId(unitId) ? null : unitId,
      title: unit?.title ?? '',
      type_key: unit?.type_key ?? '',
      duration_min: unit?.duration_min != null ? String(unit.duration_min) : '',
      muscle_groups: unit?.muscle_groups ?? [],
      _selectedUnitKey: unitId,
    });
  }

  function addDay(isRest) {
    onChange([...days, {
      unit_id: '', _selectedUnitKey: '', title: isRest ? 'Ruhetag' : '',
      type_key: '', duration_min: '', muscle_groups: [], is_rest: isRest,
    }]);
  }

  function removeDay(index) {
    onChange(days.filter((_, i) => i !== index));
  }

  function moveDay(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= days.length) return;
    const next = [...days];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const trainingDays = days.filter((d) => !d.is_rest).length;

  return (
    <>
      {units.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 0 }}>
          Du hast noch keine eigenen Einheiten — die vordefinierten stehen trotzdem zur Auswahl.
        </p>
      )}

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
        {days.length} Tage · {trainingDays} Trainingseinheiten · {days.length - trainingDays} Ruhetage
      </div>

      {days.map((day, index) => (
        <div
          key={index}
          style={{
            padding: 10, marginBottom: 8, borderRadius: 'var(--radius-xs)',
            background: day.is_rest ? 'var(--bg-input)' : 'var(--bg-secondary)',
            border: '1.5px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <strong style={{ fontSize: '0.85rem' }}>Tag {index + 1}{day.is_rest ? ' · Ruhetag' : ''}</strong>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-secondary" onClick={() => moveDay(index, -1)} disabled={index === 0}>↑</button>
              <button className="btn btn-secondary" onClick={() => moveDay(index, 1)} disabled={index === days.length - 1}>↓</button>
              <button className="btn btn-secondary" onClick={() => removeDay(index)}>×</button>
            </div>
          </div>

          {!day.is_rest && (
            <select
              value={day._selectedUnitKey ?? day.unit_id ?? ''}
              onChange={(e) => handleUnitChange(index, e.target.value)}
            >
              <option value="">Einheit wählen…</option>
              <optgroup label="Vordefinierte Einheiten">
                {PREDEFINED_UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.title}{resolveTypeLabel(u.type_key) ? ` (${resolveTypeLabel(u.type_key)})` : ''}
                  </option>
                ))}
              </optgroup>
              {units.length > 0 && (
                <optgroup label="Deine Einheiten">
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.title}{resolveTypeLabel(u.type_key) ? ` (${resolveTypeLabel(u.type_key)})` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => addDay(false)}>+ Trainingstag</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => addDay(true)}>+ Ruhetag</button>
      </div>
    </>
  );
}
