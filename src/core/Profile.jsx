import { useEffect, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { useUi } from './lib/UiContext';
import * as rawAuth from './lib/rawAuth';
import { getBodyProfile, saveBodyProfile } from './lib/bodyProfileData';
import { getGoals } from './lib/goalsData';
import BodyProfileForm from './components/BodyProfileForm';
import ModuleTopBar from './components/ModuleTopBar';
import { MODULES } from './modules';

function memberSince(isoDate) {
  const start = new Date(isoDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) return 'Diesen Monat dazugekommen';
  if (months === 1) return 'Seit 1 Monat dabei';
  if (months < 12) return `Seit ${months} Monaten dabei`;
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return `Seit ${years} ${years === 1 ? 'Jahr' : 'Jahren'}${restMonths ? ` ${restMonths} Mon.` : ''} dabei`;
}

// Die Profil-Seite legt selbst keine Ziele an — sie liest nur die
// geteilte goals-Tabelle ungefiltert und gruppiert nach source_module.
// Angelegt werden Ziele im jeweiligen Modul (core/components/GoalsSection.jsx).
export default function Profile({ onOpenModule }) {
  const { session, setSession } = useAuth();
  const { showToast } = useUi();

  const [bodyProfile, setBodyProfile] = useState(null);
  const [goalsByModule, setGoalsByModule] = useState({});
  const [loading, setLoading] = useState(true);

  const [pwForm, setPwForm] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwStatus, setPwStatus] = useState(null);

  useEffect(() => {
    let aktiv = true;
    async function load() {
      try {
        const [body, goals] = await Promise.all([getBodyProfile(session), getGoals(session)]);
        if (!aktiv) return;
        setBodyProfile(body);
        const grouped = {};
        for (const g of goals) (grouped[g.source_module] ||= []).push(g);
        setGoalsByModule(grouped);
      } catch (e) {
        console.error('[Profile] Laden fehlgeschlagen:', e);
      } finally {
        if (aktiv) setLoading(false);
      }
    }
    load();
    return () => { aktiv = false; };
  }, [session]);

  async function handleBodyChange(next) {
    setBodyProfile(next);
    try {
      await saveBodyProfile(session, next);
    } catch (e) {
      showToast('Körperdaten konnten nicht gespeichert werden');
      console.error(e);
    }
  }

  async function changePassword() {
    if (pw1.length < 6) { setPwStatus({ type: 'error', text: 'Mindestens 6 Zeichen.' }); return; }
    if (pw1 !== pw2) { setPwStatus({ type: 'error', text: 'Passwörter stimmen nicht überein.' }); return; }
    try {
      await rawAuth.updatePassword(session, pw1);
      setPwStatus(null);
      setPw1(''); setPw2(''); setPwForm(false);
      showToast('Passwort geändert');
    } catch (e) {
      setPwStatus({ type: 'error', text: e.message });
    }
  }

  const modulesWithGoals = MODULES.filter((m) => goalsByModule[m.id]?.length);

  return (
    <div className="hub">
      <ModuleTopBar title="Profil" />

      {/* Konto */}
      <div className="card">
        <div className="card-title">Konto</div>
        <p style={{ fontSize: '0.9rem', marginBottom: 2 }}>{session.user.email}</p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
          {memberSince(session.user.created_at)}
        </p>

        {!pwForm ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setPwForm(true)}>Passwort ändern</button>
            <button className="btn btn-danger" onClick={() => { rawAuth.signOut(); setSession(null); }}>Abmelden</button>
          </div>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Neues Passwort</label>
              <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Wiederholen</label>
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            {pwStatus && <div className={`status-note ${pwStatus.type}`}>{pwStatus.text}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn btn-primary" onClick={changePassword}>Speichern</button>
              <button
                className="btn btn-secondary"
                onClick={() => { setPwForm(false); setPwStatus(null); setPw1(''); setPw2(''); }}
              >
                Abbrechen
              </button>
            </div>
          </>
        )}
      </div>

      {/* Körperdaten */}
      <div className="card">
        {loading || !bodyProfile ? (
          <div className="status-note">Wird geladen…</div>
        ) : (
          <BodyProfileForm value={bodyProfile} onChange={handleBodyChange} />
        )}
        <p style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Gilt app-weit — z.&nbsp;B. für Ernährung und künftig Sport.
        </p>
      </div>

      {/* Ziele-Vorschau je Modul */}
      <div className="hub-activity-label">Ziele &amp; Meilensteine</div>
      <div className="card hub-activity-card">
        {!loading && modulesWithGoals.length === 0 && (
          <div className="status-note">Noch keine Ziele — leg sie im jeweiligen Modul an.</div>
        )}
        {modulesWithGoals.map((m, i) => {
          const goals = goalsByModule[m.id];
          const erledigt = goals.filter((g) => g.milestones?.length > 0 && g.milestones.every((ms) => ms.done)).length;
          return (
            <div
              key={m.id}
              className="hub-activity-row"
              style={{ cursor: 'pointer', borderBottom: i === modulesWithGoals.length - 1 ? 'none' : undefined }}
              onClick={() => onOpenModule(m.id)}
            >
              <div className="hub-activity-left">
                <span className="hub-module-dot" style={{ background: m.color }} />
                <div>
                  <div className="hub-activity-title">{m.name}</div>
                  <div className="hub-activity-time">{erledigt} von {goals.length} erledigt</div>
                </div>
              </div>
              <div className="hub-activity-value">{goals.length}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
