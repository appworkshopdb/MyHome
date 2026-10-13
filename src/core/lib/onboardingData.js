import { useEffect, useState } from 'react';
import { getSupabase } from './supabaseClient';

// Onboarding-Zustand + Anzeigename + gesehene Tutorials — drei Spalten in
// body_profile (Migrationen: supabase/onboarding_migration.sql und tutorials_migration.sql,
// vor Nutzung auf der ECHTEN DB ausführen). Gleiches Cache-/Event-Muster wie avatarData.js:
// ein Laden pro Nutzer, Änderungen per Event an alle Hook-Nutzer.

const EVENT = 'nestua:profile-meta-changed';
const cache = new Map(); // userId -> Promise<{display_name, onboarding_done}>

export function getProfileMeta(session) {
  const id = session.user.id;
  if (!cache.has(id)) {
    cache.set(id, (async () => {
      const sb = getSupabase();
      let { data, error } = await sb
        .from('body_profile')
        .select('display_name, onboarding_completed_at, tutorials_done')
        .eq('owner_id', id)
        .maybeSingle();
      // Fehlt nur tutorials_done (Migration noch nicht eingespielt), bleibt der
      // Registrierungs-Wizard in Funktion, die Tutorials sind dann aus
      // (tutorials_done = null).
      let tutorialsOk = !error;
      if (error) {
        ({ data, error } = await sb
          .from('body_profile')
          .select('display_name, onboarding_completed_at')
          .eq('owner_id', id)
          .maybeSingle());
      }
      if (error) {
        // Fail-open: fehlt die Migration, soll niemand in einem Wizard
        // festhängen, der sich nicht abschließen lässt.
        console.warn('[Onboarding] nicht ladbar (Migration ausgeführt?):', error.message);
        return { display_name: null, onboarding_done: true, tutorials_done: null, failed: true };
      }
      if (!tutorialsOk) console.warn('[Tutorials] Spalte tutorials_done fehlt (supabase/tutorials_migration.sql) — Tutorials aus.');
      return {
        display_name: data?.display_name ?? null,
        onboarding_done: Boolean(data?.onboarding_completed_at),
        tutorials_done: tutorialsOk ? (data?.tutorials_done ?? []) : null,
      };
    })());
  }
  return cache.get(id);
}

// patch: { display_name?, onboarding_done?, tutorials_done? }
export async function saveProfileMeta(session, patch) {
  const id = session.user.id;
  const payload = { owner_id: id };
  if ('display_name' in patch) payload.display_name = patch.display_name;
  if ('tutorials_done' in patch) payload.tutorials_done = patch.tutorials_done;
  if (patch.onboarding_done) payload.onboarding_completed_at = new Date().toISOString();
  const { error } = await getSupabase().from('body_profile').upsert(payload, { onConflict: 'owner_id' });
  if (error) throw error;
  const before = await getProfileMeta(session);
  cache.set(id, Promise.resolve({ ...before, ...patch, failed: false }));
  window.dispatchEvent(new Event(EVENT));
}

function useMeta(session) {
  const [meta, setMeta] = useState(null);
  const userId = session?.user?.id;
  // Abhängig von der Nutzer-Id, nicht vom Session-Objekt: das ändert sich
  // bei jedem Token-Refresh und würde sonst jedes Mal neu laden.
  useEffect(() => {
    setMeta(null); // Nutzerwechsel: nie die Daten der vorherigen Person zeigen
    if (!session) return undefined;
    let aktiv = true;
    const load = () => getProfileMeta(session).then((m) => { if (aktiv) setMeta(m); });
    load();
    window.addEventListener(EVENT, load);
    return () => { aktiv = false; window.removeEventListener(EVENT, load); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  return meta;
}

// → { loading, needed, meta }; needed = Wizard anzeigen.
export function useOnboardingStatus(session) {
  const meta = useMeta(session);
  return { loading: !meta, needed: Boolean(meta) && !meta.onboarding_done, meta };
}

export function useDisplayName(session) {
  return useMeta(session)?.display_name ?? null;
}

// Tutorial als gesehen markieren (sofort lokal, dann in der DB). Fehler werden
// nur geloggt: im schlimmsten Fall erscheint das Tutorial beim nächsten Start
// noch einmal.
export async function markTutorialDone(session, tutorialId) {
  const before = await getProfileMeta(session);
  if (!before.tutorials_done || before.tutorials_done.includes(tutorialId)) return;
  const next = [...before.tutorials_done, tutorialId];
  try {
    await saveProfileMeta(session, { tutorials_done: next });
  } catch (e) {
    console.warn('[Tutorials] Speichern fehlgeschlagen:', e?.message || e);
    cache.set(session.user.id, Promise.resolve({ ...before, tutorials_done: next }));
    window.dispatchEvent(new Event(EVENT));
  }
}

// → null (lädt / Tutorials aus) | Array gesehener Tutorial-Ids
export function useTutorialsDone(session) {
  return useMeta(session)?.tutorials_done ?? null;
}
