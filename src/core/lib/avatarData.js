import { useEffect, useState } from 'react';
import { getSupabase } from './supabaseClient';

// Profilbild — als kleines JPEG-Data-URL (256×256) in body_profile.avatar.
// Bewusst NICHT in auth user_metadata (landet im JWT) und nicht im Storage
// (kein Bucket nötig). Spalte anlegen: supabase/avatar_migration.sql — vor
// Nutzung auf der ECHTEN DB ausführen (nicht nur in Studio verifizieren).
// Fehlt die Spalte, bleibt die Initiale als Fallback sichtbar.

const EVENT = 'nestua:avatar-changed';
const cache = new Map(); // userId -> Promise<string|null>

export function getAvatar(session) {
  const id = session.user.id;
  if (!cache.has(id)) {
    cache.set(id, (async () => {
      const { data, error } = await getSupabase()
        .from('body_profile').select('avatar').eq('owner_id', id).maybeSingle();
      if (error) { console.warn('[Avatar] nicht ladbar:', error.message); return null; }
      return data?.avatar ?? null;
    })());
  }
  return cache.get(id);
}

export async function saveAvatar(session, dataUrl) {
  const id = session.user.id;
  const { error } = await getSupabase()
    .from('body_profile').upsert({ owner_id: id, avatar: dataUrl }, { onConflict: 'owner_id' });
  if (error) throw error;
  cache.set(id, Promise.resolve(dataUrl));
  window.dispatchEvent(new Event(EVENT));
}

export function useAvatar(session) {
  const [avatar, setAvatar] = useState(null);
  useEffect(() => {
    if (!session) return undefined;
    let aktiv = true;
    const load = () => getAvatar(session).then((a) => { if (aktiv) setAvatar(a); });
    load();
    window.addEventListener(EVENT, load);
    return () => { aktiv = false; window.removeEventListener(EVENT, load); };
  }, [session]);
  return avatar;
}

// Mittig quadratisch zuschneiden, auf 256px verkleinern, als JPEG kodieren.
export function fileToAvatarDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(
        img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size,
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden')); };
    img.src = url;
  });
}
