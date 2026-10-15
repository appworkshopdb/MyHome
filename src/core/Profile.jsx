import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { useUi } from './lib/UiContext';
import * as rawAuth from './lib/rawAuth';
import { getBodyProfile, saveBodyProfile, BODY_REQUIRED_FIELDS } from './lib/bodyProfileData';
import { getDietProfile, saveDietProfile, DIET_OPTIONS } from './lib/dietProfileData';
import { computeBody, GOAL_NOTE, METRIC_INFO } from './lib/bodyCalc';
import { BodyDataForm, ActivityGoalForm, ACTIVITY, GOAL, TRAINING_FOCUS } from './components/BodyProfileForm';
import { useAvatar } from './lib/avatarData';
import AvatarEditor from './components/AvatarEditor';
import { useRoute } from './lib/useRoute';
import { getMissingFields } from './lib/requiredData';
import { useGamificationStore } from './lib/gamificationStore';
import Bird from './components/birds/Bird';
import { STAGE_NAMES } from './components/birds/birdArt';
import ModuleTopBar from './components/ModuleTopBar';
import Modal from './components/Modal';
import { IconInfo, IconEdit } from './components/Icons';

const labelOf = (list, key) => list.find((x) => x.key === key)?.label || '';
const fmt = (n) => n.toLocaleString('de-DE');

const Chevron = () => (
  <svg className="prof-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
);
const RowIcon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ICONS = {
  koerper: <RowIcon><circle cx="12" cy="5" r="2.5" /><path d="M12 8v7M7 11h10M9 21l3-6 3 6" /></RowIcon>,
  // Geschlechtssymbole fürs Körperdaten-Icon (Mars/Venus), je nach Auswahl
  mars: <RowIcon><circle cx="10" cy="14" r="5.5" /><path d="M14 10l6-6M15 4h5v5" /></RowIcon>,
  venus: <RowIcon><circle cx="12" cy="9" r="5.5" /><path d="M12 14.5V22M9 18.5h6" /></RowIcon>,
  ziel: <RowIcon><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></RowIcon>,
  ernaehrung: <RowIcon><path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z" /><path d="M5 19l8-8" /></RowIcon>,
  werte: <RowIcon><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></RowIcon>,
};

// Eine aufklappbare Zeile: Kurzwerte im Kopf, Bearbeiten im Körper.
function Row({ id, icon, open, onToggle, title, summary, bad, children }) {
  return (
    <div className={`prof-row${open ? ' open' : ''}`}>
      <button className="prof-row-head" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="prof-ico">{icon || ICONS[id]}</span>
        <span className="prof-row-text">
          <b>{title}</b>
          <span className={bad ? 'bad' : ''}>{summary}</span>
        </span>
        <Chevron />
      </button>
      <div className="prof-row-body"><div><div className="prof-row-inner">{children}</div></div></div>
    </div>
  );
}

// Trainingsfokus zusätzlich zu BODY_REQUIRED_FIELDS: Profile.jsx ist die
// allgemeine Seite für ALLE Module (auch Sport), core darf dafür aber
// nicht direkt SPORT_REQUIRED_FIELDS aus modules/sport importieren
// (Architektur-Regel: core importiert nie aus modules/*). Deshalb hier
// eine eigene, manuell synchron zu haltende Ergänzung — ändert sich
// modules/sport/lib/requiredFields.js, hier nachziehen.
const PROFILE_REQUIRED_FIELDS = [...BODY_REQUIRED_FIELDS, { key: 'training_focus', label: 'Trainingsfokus' }];


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

// Die Profil-Seite (Avatar-Button rechts): EINE Seite. Oben Konto + Kalorienziel,
// darunter vier aufklappbare Bereiche mit ihren Kurzwerten (Körperdaten,
// Aktivität & Ziel, Ernährungsform, Deine Werte). Ernährungsform + BMI-Ergebnis
// sind aus dem Ernährungs-Modul hierher migriert — Formeln/Datenzugriffe in
// lib/bodyCalc.js und lib/dietProfileData.js. Benachrichtigungen sitzen im
// linken Einstellungs-Menü (AppMenu.jsx).
export default function Profile({ hasWarnings }) {
  const { navigate } = useRoute();
  const { session, setSession } = useAuth();
  const { showToast } = useUi();
  const gami = useGamificationStore();

  const [bodyProfile, setBodyProfile] = useState(null);
  const [dietProfile, setDietProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [infoKey, setInfoKey] = useState(null); // welches Info-Modal offen ist
  const [openRow, setOpenRow] = useState(null);
  const [autoOpened, setAutoOpened] = useState(false);

  const avatar = useAvatar(session);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [pwForm, setPwForm] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwStatus, setPwStatus] = useState(null);

  useEffect(() => {
    let aktiv = true;
    async function load() {
      try {
        const [body, diet] = await Promise.all([
          getBodyProfile(session),
          getDietProfile(session),
        ]);
        if (!aktiv) return;
        setBodyProfile(body);
        setDietProfile(diet);
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

  // Fehlende Pflichtangaben je Bereich → Zeile rot, und beim ersten Laden
  // klappt der erste unvollständige Bereich von selbst auf.
  const missingBody = bodyProfile ? getMissingFields(BODY_REQUIRED_FIELDS.filter((f) => ['gender', 'age', 'height', 'weight'].includes(f.key)), bodyProfile) : [];
  const missingGoal = bodyProfile ? getMissingFields(PROFILE_REQUIRED_FIELDS.filter((f) => ['activity', 'goal', 'training_focus'].includes(f.key)), bodyProfile) : [];
  useEffect(() => {
    if (autoOpened || !bodyProfile) return;
    setAutoOpened(true);
    if (missingBody.length) setOpenRow('koerper');
    else if (missingGoal.length) setOpenRow('ziel');
  }, [bodyProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setOpenRow((cur) => (cur === id ? null : id));

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

  const initial = session.user.email?.[0]?.toUpperCase() || '?';
  const species = gami.bird_species || 'robin';
  const bp = bodyProfile;

  const bodySummary = !bp ? 'Wird geladen…'
    : missingBody.length ? `${missingBody.map((f) => f.label).join(', ')} fehlt`
      : `${bp.gender === 'm' ? 'Männlich' : 'Weiblich'} · ${bp.age} J. · ${bp.height} cm · ${bp.weight} kg`;
  const goalSummary = !bp ? 'Wird geladen…'
    : missingGoal.length ? `${missingGoal.map((f) => f.label).join(', ')} fehlt`
      : `${labelOf(GOAL, bp.goal)} · ${labelOf(ACTIVITY, bp.activity)} · ${labelOf(TRAINING_FOCUS, bp.training_focus)}`;
  const dietSummary = dietProfile ? (DIET_OPTIONS.find((d) => d.key === dietProfile.diet)?.label || 'Alles') : 'Wird geladen…';
  const valuesSummary = body ? `${fmt(body.tdee)} kcal Bedarf · ${body.protein} g Protein · ${body.water} L Wasser` : 'Körperdaten fehlen';

  return (
    <div className="hub with-topbar-space">
      <ModuleTopBar title="Profil" hasWarnings={hasWarnings} onBack={() => navigate('')} />

      {/* Konto */}
      <div className="card prof-ident-card">
        <div className="prof-ident">
          <button className="prof-avatar-pick" onClick={() => setAvatarOpen(true)} aria-label="Profilbild ansehen und bearbeiten">
            <span className="profile-avatar">
              {avatar ? <img src={avatar} alt="" /> : initial}
            </span>
            <span className="profile-avatar-edit" aria-hidden="true"><IconEdit /></span>
          </button>
          <div className="prof-who">
            <div className="prof-mail">{session.user.email}</div>
            <div className="prof-since">{memberSince(session.user.created_at)}</div>
            <div className="prof-chips">
              {gami.loaded && (
                <span className="prof-chip warm">
                  <Bird species={species} stage={gami.level} head size={18} animated={false} />
                  {STAGE_NAMES[gami.level]} · Level {gami.level}
                </span>
              )}
              {gami.loaded && <span className="prof-chip">{gami.current_streak} {gami.current_streak === 1 ? 'Tag' : 'Tage'} Streak</span>}
            </div>
          </div>
        </div>

        {!pwForm ? (
          <div className="prof-acts">
            <button className="btn btn-secondary" onClick={() => setPwForm(true)}>Passwort ändern</button>
            <button className="btn btn-danger" onClick={() => { rawAuth.signOut(); setSession(null); }}>Abmelden</button>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
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
          </div>
        )}
      </div>

      {/* Kalorienziel immer sichtbar */}
      {body && (
        <div className="prof-hero">
          <div>
            <div className="prof-hero-k">Dein Kalorienziel</div>
            <div className="prof-hero-v">{fmt(body.target)} <small>kcal</small></div>
          </div>
          <div className="prof-hero-mini">
            <div><b>{body.protein} g</b>Protein</div>
            <div><b>{String(body.bmi).replace('.', ',')}</b>BMI</div>
          </div>
        </div>
      )}

      <div className="prof-acc">
        <Row id="koerper" icon={bp?.gender === 'm' ? ICONS.mars : bp?.gender === 'w' ? ICONS.venus : null} open={openRow === 'koerper'} onToggle={toggle} title="Körperdaten" summary={bodySummary} bad={missingBody.length > 0}>
          {bp && <BodyDataForm value={bp} onChange={handleBodyChange} requiredFields={PROFILE_REQUIRED_FIELDS} showTitle={false} />}
          <p className="profile-section-hint">Gilt app-weit — für Ernährung und Sport.</p>
        </Row>

        <Row id="ziel" open={openRow === 'ziel'} onToggle={toggle} title="Aktivität & Ziel" summary={goalSummary} bad={missingGoal.length > 0}>
          {bp && <ActivityGoalForm value={bp} onChange={handleBodyChange} requiredFields={PROFILE_REQUIRED_FIELDS} showTitle={false} />}
          <p className="profile-section-hint">Trainingsfokus und Sportarten steuern das Sport-Modul.</p>
        </Row>

        <Row id="ernaehrung" open={openRow === 'ernaehrung'} onToggle={toggle} title="Ernährungsform" summary={dietSummary}>
          {dietProfile && (
            <div className="segmented cols-4">
              {DIET_OPTIONS.map((d) => (
                <button key={d.key} className={dietProfile.diet === d.key ? 'active' : ''} onClick={() => handleDietChange(d.key)}>
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </Row>

        <Row id="werte" open={openRow === 'werte'} onToggle={toggle} title="Deine Werte" summary={valuesSummary}>
          {!body ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Trag unter „Körperdaten“ Alter, Größe und Gewicht ein, um deine Werte zu sehen.
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
        </Row>
      </div>

      {loading && <div className="status-note">Wird geladen…</div>}

      {avatarOpen && (
        <AvatarEditor avatar={avatar} initial={initial} onClose={() => setAvatarOpen(false)} />
      )}

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
