import { formatRelativeDate } from '../../../core/lib/format';
import { resolveTypeLabel } from '../lib/typeLabel';
import { IconCheck, IconEdit, IconTrash } from '../../../core/components/Icons';
import { planDayFor } from '../../../core/lib/sportPlanSync';
import { todayIso } from '../../../core/lib/wizardDates';

// Zeigt alle Einheiten des gewählten Tages. Das Abhaken passiert direkt
// hier über die Checkbox (Konzept-Entscheidung) — ein Klick genügt,
// kein Umweg über das Formular. Der DB-Trigger übernimmt daraufhin die
// Auswertungs-Kennzahlen.
// activePlan = { start_date, plan } oder null (Dauerplan). Eigene Einträge haben
// Vorrang vor dem Plan; Plan-Einträge lassen sich bearbeiten, aber nicht löschen
// (auslassen = "+ Ruhetag" eintragen).
export default function DayDetail({ date, workouts, plans, activePlan, onToggleDone, onEdit, onDelete, onPlanNew, onAddRest }) {
  const dayWorkouts = workouts.filter((w) => w.occurred_on === date);

  // Steht an diesem Tag nur ein eigener Eintrag, ruht die Plan-Einheit darunter.
  // Löscht man den Eintrag, gilt sie wieder (nur heute und später, Vergangenes
  // wird nie nachgetragen).
  const hasAuto = dayWorkouts.some((w) => w.auto_planned);
  const hiddenPlanDay = activePlan && dayWorkouts.length > 0 && !hasAuto && date >= todayIso()
    ? planDayFor(activePlan.plan.items, activePlan.start_date, date)
    : null;

  // "Tag X von Y" nur berechenbar, wenn plan_day_index gesetzt ist
  // (erst seit dieser Migration) UND der zugehörige Plan noch existiert
  // (nicht gelöscht wurde) — sonst bewusst kein Fortschritt anzeigen
  // statt zu raten.
  function planProgress(w) {
    if (w.plan_id == null || w.plan_day_index == null) return null;
    const plan = plans?.find((p) => p.id === w.plan_id);
    if (!plan) return null;
    return `${w.auto_planned ? 'Aus Plan · ' : ''}Tag ${w.plan_day_index + 1} von ${plan.items.length} · ${plan.title}`;
  }

  return (
    <div className="sd">
      <div className="sd-eyebrow">{formatRelativeDate(date)}</div>

      {dayWorkouts.length === 0 ? (
        <p className="sd-empty">Keine Einheit an diesem Tag.</p>
      ) : (
        dayWorkouts.map((w) => {
          // Ruhetag: eigene, bewusst ruhigere Darstellung — kein
          // Abhaken (es gibt nichts zu erledigen) und kein Bearbeiten
          // (WorkoutForm unterstützt seit der Ruhetag-Option im
          // Einzeleintragen auch is_rest korrekt, siehe WorkoutForm.jsx).
          if (w.is_rest) {
            return (
              <div key={w.id} className="sd-row sd-row--rest">
                <span className="sd-check sd-check--rest" aria-hidden="true" />
                <div className="sd-body">
                  <div className="sd-title">{w.title}</div>
                  {planProgress(w) && <div className="sd-meta">{planProgress(w)}</div>}
                </div>
                <button className="sd-ghost" onClick={() => onEdit(w)} aria-label="Bearbeiten"><IconEdit /></button>
                {!w.auto_planned && <button className="sd-ghost" onClick={() => onDelete(w.id)} aria-label="Löschen"><IconTrash /></button>}
              </div>
            );
          }

          const done = w.status === 'done';
          const typeLabel = resolveTypeLabel(w.type_key);
          return (
            <div key={w.id} className="sd-row">
              <button
                className={`sd-check ${done ? 'on' : ''}`}
                onClick={() => onToggleDone(w)}
                aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
              >
                {done && <IconCheck />}
              </button>

              <div className="sd-body">
                <div className="sd-title">{w.title}</div>
                <div className="sd-meta">
                  {done ? 'Erledigt' : 'Geplant'}
                  {typeLabel ? ` · ${typeLabel}` : ''}
                </div>
                {w.notes && <div className="sd-meta sd-notes">{w.notes}</div>}
                {planProgress(w) && <div className="sd-meta sd-notes">{planProgress(w)}</div>}
              </div>

              <button className="sd-ghost" onClick={() => onEdit(w)} aria-label="Bearbeiten"><IconEdit /></button>
              {!w.auto_planned && <button className="sd-ghost" onClick={() => onDelete(w.id)} aria-label="Löschen"><IconTrash /></button>}
            </div>
          );
        })
      )}

      {hiddenPlanDay && (
        <div className="sd-planhint">
          Plan-Einheit „{hiddenPlanDay.item.is_rest ? 'Ruhetag' : hiddenPlanDay.item.title}“ ruht, solange dieser Eintrag besteht. Löschst du ihn, gilt sie wieder.
        </div>
      )}

      <div className="sd-actions">
        <button className="sd-btn sd-btn--out" onClick={() => onPlanNew(date)}>
          + Einzelne Einheit
        </button>
        <button className="sd-btn sd-btn--fill" onClick={() => onAddRest(date)} disabled={dayWorkouts.some((w) => w.is_rest)}>
          + Ruhetag
        </button>
      </div>
    </div>
  );
}
