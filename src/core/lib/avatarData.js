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

export const removeAvatar = (session) => saveAvatar(session, null);

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

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    img.src = src;
  });
}

// Zeichnet den Ausschnitt quadratisch auf ctx (size×size). zoom ≥ 1,
// (offX, offY) = Verschiebung in Zielpixeln; wird so begrenzt, dass das
// Bild das Quadrat immer vollständig füllt. Gibt die begrenzte Verschiebung zurück.
export function drawCrop(ctx, img, size, zoom, offX, offY) {
  const base = size / Math.min(img.width, img.height);
  const w = img.width * base * zoom;
  const h = img.height * base * zoom;
  const x = Math.min(0, Math.max(size - w, (size - w) / 2 + offX));
  const y = Math.min(0, Math.max(size - h, (size - h) / 2 + offY));
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, x, y, w, h);
  return { offX: x - (size - w) / 2, offY: y - (size - h) / 2 };
}
