import { getSupabase } from '../../../core/lib/supabaseClient';

function ownerId(session) {
  return session.user.id;
}

// ---------------------------------------------------------------------
// Trainingseinheiten (spo_workouts)
// ---------------------------------------------------------------------
// Bewusst nur diese eine Tabelle im Zugriff: eine Einheit wird als
// Ganzes erfasst (Datum, Typ, Dauer, Notiz), nicht Satz für Satz.
// spo_entries existiert in der DB weiterhin, wird hier aber nicht
// beschrieben. Eine Einheit kann 'planned' (im Kalender vorausgeplant)
// oder 'done' (abgehakt/direkt eingetragen) sein — der Wechsel läuft
// über setWorkoutStatus().

// Limit großzügig: der Kalender blättert durch Monate und die Auswertung
// rechnet über mehrere Monate — bei 50 Zeilen würden ältere Monate
// unbemerkt leer wirken.
export async function getWorkouts(session, limit = 500) {
  const { data, error } = await getSupabase()
    .from('spo_workouts')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function saveWorkout(session, workout) {
  const payload = {
    ...workout,
    owner_id: ownerId(session),
    // status kommt jetzt vom Aufrufer: 'done' beim direkten Eintragen,
    // 'planned' beim Vorausplanen im Kalender. Der DB-Trigger
    // (spo_workouts_to_measurement) schreibt die Hub-/Auswertungs-
    // Kennzahlen NUR bei 'done' — geplante Einheiten tauchen also
    // korrekterweise noch nicht in der Auswertung auf.
    status: workout.status ?? 'done',
  };
  const { data, error } = await getSupabase().from('spo_workouts').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

// Abhaken/Zurücksetzen direkt aus der Tagesansicht. Der Statuswechsel
// allein genügt — der DB-Trigger legt die measurements-Zeilen an bzw.
// räumt sie beim Zurücksetzen wieder ab (er löscht am Anfang immer
// erst alles zu dieser source_ref_id).
export async function setWorkoutStatus(id, done) {
  const { error } = await getSupabase()
    .from('spo_workouts')
    .update({
      status: done ? 'done' : 'planned',
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteWorkout(id) {
  // Soft delete, damit Sync zwischen Geräten konsistent bleibt. Der
  // Measurement-Trigger reagiert auf AFTER INSERT OR UPDATE und prüft
  // deleted_at selbst — die zugehörigen measurements-Zeilen werden also
  // automatisch entfernt, sobald deleted_at hier gesetzt wird.
  const { error } = await getSupabase()
    .from('spo_workouts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Einheiten-Bibliothek (spo_units)
// ---------------------------------------------------------------------
// Wiederverwendbare einzelne Trainingseinheiten (z.B. "Arme", "Legday")
// — nicht zu verwechseln mit spo_plans, das jetzt MEHRERE Einheiten zu
// einer Mehrtages-Vorlage zusammensetzt.

export async function getUnits(session) {
  const { data, error } = await getSupabase()
    .from('spo_units')
    .select('*')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('title', { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveUnit(session, unit) {
  const payload = {
    ...(unit.id ? { id: unit.id } : {}),
    owner_id: ownerId(session),
    title: unit.title,
    type_key: unit.type_key || null,
    duration_min: unit.duration_min ?? null,
    muscle_groups: unit.muscle_groups ?? [],
  };
  const { data, error } = await getSupabase().from('spo_units').upsert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteUnit(id) {
  const { error } = await getSupabase()
    .from('spo_units')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Trainingsplan-Vorlagen (spo_plans + spo_plan_items)
// ---------------------------------------------------------------------
// Eine Vorlage ist eine Folge von TAGEN beliebiger Länge (day_index 0..n),
// jeder Tag entweder eine Einheit (referenziert per unit_id, Titel/Typ/
// Dauer zusätzlich als Snapshot — ein späteres Bearbeiten der Einheit
// verändert dadurch keine bereits gespeicherten Pläne) oder ein
// Ruhetag. Die Länge ergibt sich aus der Anzahl der Tage, nicht aus
// einer festen Wochenstruktur.

export async function getPlans(session) {
  const { data, error } = await getSupabase()
    .from('spo_plans')
    .select('*, items:spo_plan_items(*)')
    .eq('owner_id', ownerId(session))
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Gelöschte Tage filtern und sortieren — der eingebettete Select
  // kennt weder unsere Soft-Delete-Konvention noch die Reihenfolge.
  return (data ?? []).map((plan) => ({
    ...plan,
    items: (plan.items ?? [])
      .filter((i) => !i.deleted_at)
      .sort((a, b) => a.day_index - b.day_index),
  }));
}

export async function savePlan(session, plan, items) {
  const owner = ownerId(session);

  const { data: savedPlan, error: planError } = await getSupabase()
    .from('spo_plans')
    .upsert({
      ...(plan.id ? { id: plan.id } : {}),
      owner_id: owner,
      title: plan.title,
      notes: plan.notes ?? null,
    })
    .select()
    .single();
  if (planError) throw planError;

  // Tage komplett ersetzen statt einzeln zu diffen: eine Vorlage ist
  // klein (meist < 10 Zeilen), und Einfügen/Löschen/Umsortieren von
  // Tagen wäre sonst deutlich fehleranfälliger als ein sauberer Neuaufbau.
  const { error: delError } = await getSupabase()
    .from('spo_plan_items')
    .delete()
    .eq('plan_id', savedPlan.id);
  if (delError) throw delError;

  if (items.length > 0) {
    const { error: itemError } = await getSupabase()
      .from('spo_plan_items')
      .insert(items.map((item, index) => ({
        owner_id: owner,
        plan_id: savedPlan.id,
        day_index: index,
        unit_id: item.unit_id ?? null,
        title: item.title,
        type_key: item.type_key ?? null,
        duration_min: item.duration_min ?? null,
        is_rest: item.is_rest ?? false,
        notes: item.notes ?? null,
      })));
    if (itemError) throw itemError;
  }

  return savedPlan;
}

export async function deletePlan(id) {
  const { error } = await getSupabase()
    .from('spo_plans')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Überträgt eine Vorlage ab startDate in den Kalender: day_index 0 liegt
// auf startDate, day_index 3 drei Tage später usw. Ruhetage erzeugen
// bewusst KEINE Einheit — sie verschieben nur die Folgetage, damit ein
// 5-Tage-Plan mit Ruhetag am dritten Tag korrekt über 5 Kalendertage
// läuft. Bestehende Einträge bleiben unangetastet, deshalb lassen sich
// ein Wochenplan und einzelne Sport-Einheiten am selben Tag kombinieren.
export async function applyPlan(session, plan, startDate) {
  const start = new Date(`${startDate}T00:00:00`);

  // Ruhetage werden jetzt MIT angelegt (is_rest: true), damit der
  // Kalender sie markieren kann — sie verschieben weiterhin nur die
  // Folgetage (day_index bleibt unverändert), zählen aber wegen
  // is_rest weder in der Auswertung noch im Hub als Training (siehe
  // DB-Trigger, der bei is_rest keine measurements schreibt).
  const rows = plan.items.map((item) => {
    const date = new Date(start);
    date.setDate(date.getDate() + item.day_index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      owner_id: ownerId(session),
      occurred_on: iso,
      // Ein Ruhetag hat nichts zu erledigen — 'done' statt 'planned',
      // damit er nicht wie eine offene Aufgabe wirkt.
      status: item.is_rest ? 'done' : 'planned',
      is_rest: item.is_rest,
      type_key: item.is_rest ? null : (item.type_key || 'sonstiges'),
      title: item.title,
      duration_min: item.duration_min ?? null,
      notes: item.notes ?? null,
      plan_id: plan.id,
      // Speichert die Position in der Vorlage direkt mit — sonst ließe
      // sich "Tag X von Y" später nicht mehr zuverlässig rekonstruieren,
      // vor allem wenn derselbe Plan mehrfach zu unterschiedlichen
      // Terminen eingetragen wird (dann wäre plan_id allein mehrdeutig).
      plan_day_index: item.day_index,
    };
  });

  if (rows.length === 0) return 0;

  const { error } = await getSupabase().from('spo_workouts').insert(rows);
  if (error) throw error;
  return rows.length;
}
