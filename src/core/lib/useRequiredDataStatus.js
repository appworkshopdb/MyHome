import { useEffect, useState } from 'react';
import { getAllRequirementStatus } from './requiredDataRegistry';

// Ein Hook, eine Datenquelle — App.jsx nutzt ihn, um sowohl das
// Popup (unten links, auf jedem Screen sichtbar) als auch den
// Warnpunkt am Profil-Menüpunkt zu speisen, statt beides getrennt
// zu laden.
export function useRequiredDataStatus(session) {
  const [warnings, setWarnings] = useState([]);

  async function refresh() {
    if (!session) return;
    try {
      setWarnings(await getAllRequirementStatus(session));
    } catch (e) {
      console.error('[requiredData] Status konnte nicht geladen werden:', e);
    }
  }

  useEffect(() => { refresh(); }, [session]);

  // Sofort neu prüfen, wenn irgendwo Pflichtdaten gespeichert wurden
  // (siehe bodyProfileData.js saveBodyProfile) — sonst bliebe die
  // Meldung bis zum nächsten vollständigen Neuladen der App stehen.
  useEffect(() => {
    function onDataChanged() { refresh(); }
    window.addEventListener('zuhause:required-data-refresh', onDataChanged);
    return () => window.removeEventListener('zuhause:required-data-refresh', onDataChanged);
  }, [session]);

  return { warnings, refresh };
}
