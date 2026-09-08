import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { useUi } from './lib/UiContext';
import * as rawAuth from './lib/rawAuth';
import { getBodyProfile, saveBodyProfile, BODY_REQUIRED_FIELDS } from './lib/bodyProfileData';
import { getDietProfile, saveDietProfile } from './lib/dietProfileData';
import { computeBody, GOAL_NOTE, METRIC_INFO } from './lib/bodyCalc';
import { getGoals } from './lib/goalsData';
import BodyProfileForm from './components/BodyProfileForm';
import ModuleTopBar from './components/ModuleTopBar';
import Modal from './components/Modal';
import { IconInfo } from './components/Icons';
import { MODULES } from './modules';

// Trainingsfokus zusätzlich zu BODY_REQUIRED_FIELDS: Profile.jsx ist die
// allgemeine Seite für ALLE Module (auch Sport), core darf dafür aber
// nicht direkt SPORT_REQUIRED_FIELDS aus modules/sport importieren
// (Architektur-Regel: core importiert nie aus modules/*). Deshalb hier
// eine eigene, manuell synchron zu haltende Ergänzung — ändert sich
// modules/sport/lib/requiredFields.js, hier nachziehen.
const PROFILE_REQUIRED_FIELDS = [...BODY_REQUIRED_FIELDS, { key: 'training_focus', label: 'Trainingsfokus' }];

const DIET_OPTIONS = [
  { key: 'alles', label: 'Alles' }, { key: 'vegetarisch', label: 'Vegetarisch' },
  { key: 'vegan', label: 'Vegan' }, { key: 'glutenfrei', label: 'Glutenfrei' },
];

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

// Die Profil-Seite (Avatar-Button rechts) ist bewusst nur noch für
// Konto/Körperdaten/Ernährungsform/Ziele zuständig — Benachrichtigungen
// sitzen jetzt im linken Dropdown-Menü (AppMenu.jsx), neben Design.
// Ernährungsform + BMI-Ergebnis sind aus dem Ernährungs-Modul hierher
// migriert (dessen eigener "Profil"-Tab wurde entfernt, siehe
// Projektkontext.md) — die zugehörigen Formeln/Datenzugriffe liegen
// dafür jetzt in lib/bodyCalc.js und lib/dietProfileData.js.
// Legt selbst keine Ziele an — liest nur die geteilte goals-Tabelle
// ungefiltert und gruppiert nach source_module. Angelegt werden Ziele im
// jeweiligen Modul (core/components/GoalsSection.jsx); Ernährung hat
// aktuell bewusst keine eigene Ziele-Funktion (siehe Projektkontext.md).
export default function Profile({ onOpenModule }) {
  const { session, setSession } = useAuth();
  const { showToast } = useUi();

  const [bodyProfile, setBodyProfile] = useState(null);
  const [dietProfile, setDietProfile] = useState(null);
  const [goalsByModule, setGoalsByModule] = useState({});
  const [loading, setLoading] = useState(true);
  const [infoKey, setInfoKey] = useState(null); // welches Info-Modal offen ist

  const [pwForm, setPwForm] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwStatus, setPwStatus] = useState(null);

  useEffect(() => {
    let aktiv = true;
    async function load() {
      try {
        const [body, diet, goals] = await Promise.all([
          getBodyProfile(session),
          getDietProfile(session),
          getGoals(session),
        ]);
        if (!aktiv) return;
        setBodyProfile(body);
        setDietProfile(diet);
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

  const body = useMemo(() => (bodyProfile ? computeBody(bodyProfile) : null), [bodyProfile]);

  async function handleBodyChange(next) {
    setBodyProfile(next);
    try {
      await saveBodyProfile(session, next);
    } catch (e) {
      showToast('Körperdaten konnten nicht gespeichert werden');
      console.error(e);
    }
  }

  async function handleDietChange(key) {
    const next = { ...dietProfile, diet: key };
    setDietProfile(next);
    try {
      await saveDietProfile(session, next);
    } catch (e) {
      showToast('Ernährungsform konnte nicht gespeichert werden');
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
          <BodyProfileForm value={bodyProfile} onChange={handleBodyChange} requiredFields={PROFILE_REQUIRED_FIELDS} />
        )}
        <p style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Gilt app-weit — z.&nbsp;B. für Ernährung und künftig Sport.
        </p>
      </div>

      {/* Ernährungsform (aus dem Ernährungs-Modul migriert) */}
      {!loading && dietProfile && (
        <div className="card">
          <div className="card-title">Ernährungsform</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {DIET_OPTIONS.map((d) => {
              const active = dietProfile.diet === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => handleDietChange(d.key)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: 'var(--radius-xs)',
                    border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* BMI/Kalorien-Ergebnis (aus dem Ernährungs-Modul migriert, um
          Fett-/KH-Ziel und Idealgewicht-Bereich ergänzt) */}
      {!loading && (
        <div className="card">
          <div className="card-title">Dein Ergebnis</div>
          {!body ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Trag oben Alter, Größe und Gewicht ein, um dein Ergebnis zu sehen.
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <ResultTile metricKey="bmi" value={body.bmi} note={body.bmiCat} onInfo={setInfoKey} />
                <ResultTile metricKey="bmr" value={body.bmr} unit="kcal" note="BMR (Mifflin-St Jeor)" onInfo={setInfoKey} />
                <ResultTile metricKey="tdee" value={body.tdee} unit="kcal" note="TDEE" onInfo={setInfoKey} />
                <ResultTile metricKey="target" value={body.target} unit="kcal" note={GOAL_NOTE[bodyProfile.goal] || ''} onInfo={setInfoKey} />
                <ResultTile metricKey="protein" value={body.protein} unit="g" note="täglich" onInfo={setInfoKey} />
                <ResultTile metricKey="fat" value={body.fatG} unit="g" note="täglich" onInfo={setInfoKey} />
                <ResultTile metricKey="carb" value={body.carbG} unit="g" note="täglich" onInfo={setInfoKey} />
                <ResultTile metricKey="water" value={body.water} unit="L" note="täglich" onInfo={setInfoKey} />
                <ResultTile metricKey="idealweight" value={`${body.wMin}–${body.wMax}`} unit="kg" note="bei deiner Größe" onInfo={setInfoKey} />
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10 }}>
                Alle Werte sind rechnerische Schätzungen auf Basis anerkannter Formeln, keine medizinische Beratung.
              </p>
            </>
          )}
        </div>
      )}

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

      {infoKey && (
        <Modal title={METRIC_INFO[infoKey].title} onClose={() => setInfoKey(null)}>
          <InfoRow label="Was ist das?" text={METRIC_INFO[infoKey].was} />
          <InfoRow label="Wofür?" text={METRIC_INFO[infoKey].wofuer} />
          <InfoRow label="Wie berechnet?" text={METRIC_INFO[infoKey].wie} />
        </Modal>
      )}
    </div>
  );
}

function InfoRow({ label, text }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function ResultTile({ metricKey, value, unit, note, onInfo }) {
  return (
    <div style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
      <button
        onClick={() => onInfo(metricKey)}
        aria-label={`Erklärung zu ${METRIC_INFO[metricKey].title}`}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 22, height: 22, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <IconInfo />
      </button>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', paddingRight: 20 }}>
        {METRIC_INFO[metricKey].title}
      </div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: 2 }}>
        {value}
        {unit && <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>}
      </div>
      {note && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{note}</div>}
    </div>
  );
}
