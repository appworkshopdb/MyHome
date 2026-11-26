import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './lib/AuthContext';
import { useUi } from './lib/UiContext';
import * as rawAuth from './lib/rawAuth';
import { getBodyProfile, saveBodyProfile, BODY_REQUIRED_FIELDS } from './lib/bodyProfileData';
import { getDietProfile, saveDietProfile, DIET_OPTIONS } from './lib/dietProfileData';
import { computeBody, GOAL_NOTE, METRIC_INFO } from './lib/bodyCalc';
import { BodyDataForm, ActivityGoalForm, ACTIVITY, GOAL, TRAINING_FOCUS } from './components/BodyProfileForm';
import { releasePushForLogout } from './lib/pushNotifications';
import { useAvatar } from './lib/avatarData';
import AvatarEditor from './components/AvatarEditor';
import { useRoute } from './lib/useRoute';
import { getMissingFields } from './lib/requiredData';
import { useGamificationStore } from './lib/gamificationStore';
import Bird from './components/birds/Bird';
import { STAGE_NAMES } from './components/birds/birdArt';
import ModuleTopBar from './components/ModuleTopBar';
import Modal from './components/Modal';
import Icon from './components/Icon';
import { SkeletonList, Skeleton, Button, TextField, Segmented } from './components/ui';
import { formatNumber, formatUnit } from './lib/format';

const labelOf = (list, key) => list.find((x) => x.key === key)?.label || '';
const fmt = (n) => n.toLocaleString('de-DE');

const ROW_ICON = { koerper: 'person', ziel: 'target', ernaehrung: 'leaf', werte: 'chart' };

// Eine aufklappbare Zeile: Kurzwerte im Kopf, Bearbeiten im Körper.
function Row({ id, open, onToggle, title, summary, bad, children }) {
  return (
    <div className={`prof-row${open ? ' open' : ''}`}>
      <button className="prof-row-head" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="prof-ico"><Icon name={ROW_ICON[id]} /></span>
        <span className="prof-row-text">
          <b>{title}</b>
          <span className={bad ? 'bad' : ''}>{summary}</span>
        </span>
        <Icon name="expand" className="prof-chev" />
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
  if (!isoDate || Number.isNaN(start.getTime())) return '';
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

  const bodySummary = !bp ? <Skeleton w={110} h={12} />
    : missingBody.length ? `${missingBody.map((f) => f.label).join(', ')} fehlt`
      : `${bp.gender === 'm' ? 'Männlich' : 'Weiblich'} · ${bp.age} J. · ${formatUnit(bp.height, 'cm', 0)} · ${formatUnit(bp.weight, 'kg', 1)}`;
  const goalSummary = !bp ? <Skeleton w={110} h={12} />
    : missingGoal.length ? `${missingGoal.map((f) => f.label).join(', ')} fehlt`
      : `${labelOf(GOAL, bp.goal)} · ${labelOf(ACTIVITY, bp.activity)} · ${labelOf(TRAINING_FOCUS, bp.training_focus)}`;
  const dietSummary = dietProfile ? (DIET_OPTIONS.find((d) => d.key === dietProfile.diet)?.label || 'Alles') : <Skeleton w={110} h={12} />;
  const valuesSummary = body ? `${fmt(body.tdee)} kcal Bedarf · ${formatUnit(body.protein, 'g', 0)} Protein · ${formatUnit(body.water, 'L', 1)} Wasser` : 'Körperdaten fehlen';

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
            <span className="profile-avatar-edit" aria-hidden="true"><Icon name="edit" size={14} /></span>
          </button>
          <div className="prof-who">
            <div className="prof-mail">{session.user.email}</div>
            {memberSince(session.user.created_at) && <div className="prof-since">{memberSince(session.user.created_at)}</div>}
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
            <Button variant="secondary" icon="lock" onClick={() => setPwForm(true)}>Passwort ändern</Button>
            <Button variant="text" onClick={async () => { await releasePushForLogout(session); rawAuth.signOut(); setSession(null); }}>Abmelden</Button>
          </div>
        ) : (
          <div className="prof-pw">
            <TextField label="Neues Passwort" type="password" autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
            <TextField label="Wiederholen" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={pwStatus?.text} />
            <div className="prof-acts">
              <Button onClick={changePassword}>Speichern</Button>
              <Button variant="secondary" onClick={() => { setPwForm(false); setPwStatus(null); setPw1(''); setPw2(''); }}>Abbrechen</Button>
            </div>
          </div>
        )}
      </div>

      {/* Kalorienziel immer sichtbar */}
      {body && (
        <div className="prof-hero">
          <div>
            <div className="prof-hero-k">Kalorienziel</div>
            <div className="prof-hero-v">{fmt(body.target)} <small>kcal</small></div>
          </div>
          <div className="prof-hero-mini">
            <div><b>{body.protein} g</b>Protein</div>
            <div><b>{String(body.bmi).replace('.', ',')}</b>BMI</div>
          </div>
        </div>
      )}

      <div className="prof-acc">
        <Row id="koerper" open={openRow === 'koerper'} onToggle={toggle} title="Körperdaten" summary={bodySummary} bad={missingBody.length > 0}>
          {bp && <BodyDataForm value={bp} onChange={handleBodyChange} requiredFields={PROFILE_REQUIRED_FIELDS} showTitle={false} />}
        </Row>

        <Row id="ziel" open={openRow === 'ziel'} onToggle={toggle} title="Aktivität & Ziel" summary={goalSummary} bad={missingGoal.length > 0}>
          {bp && <ActivityGoalForm value={bp} onChange={handleBodyChange} requiredFields={PROFILE_REQUIRED_FIELDS} showTitle={false} />}
        </Row>

        <Row id="ernaehrung" open={openRow === 'ernaehrung'} onToggle={toggle} title="Ernährungsform" summary={dietSummary}>
          {dietProfile && (
            <Segmented label="Ernährungsform" options={DIET_OPTIONS.map((d) => ({ value: d.key, label: d.label }))} value={dietProfile.diet} onChange={handleDietChange} />
          )}
        </Row>

        <Row id="werte" open={openRow === 'werte'} onToggle={toggle} title="Deine Werte" summary={valuesSummary}>
          {!body ? (
            <p className="prof-hint">Alter, Größe und Gewicht fehlen noch.</p>
          ) : (
            <>
              <div className="prof-tiles">
                <ResultTile metricKey="bmi" value={body.bmi} note={body.bmiCat} onInfo={setInfoKey} />
                <ResultTile metricKey="bmr" value={body.bmr} unit="kcal" note="BMR (Mifflin-St Jeor)" onInfo={setInfoKey} />
                <ResultTile metricKey="tdee" value={body.tdee} unit="kcal" note="TDEE" onInfo={setInfoKey} />
                <ResultTile metricKey="target" value={body.target} unit="kcal" note={GOAL_NOTE[bodyProfile.goal] || ''} onInfo={setInfoKey} />
                <ResultTile metricKey="protein" value={body.protein} unit="g" note="täglich" onInfo={setInfoKey} />
                <ResultTile metricKey="fat" value={body.fatG} unit="g" note="täglich" onInfo={setInfoKey} />
                <ResultTile metricKey="carb" value={body.carbG} unit="g" note="täglich" onInfo={setInfoKey} />
                <ResultTile metricKey="water" value={body.water} unit="L" note="täglich" onInfo={setInfoKey} />
                <ResultTile wide metricKey="idealweight" value={`${formatNumber(body.wMin, 1)}–${formatNumber(body.wMax, 1)}`} unit="kg" note="bei deiner Größe" onInfo={setInfoKey} />
              </div>
              <p className="prof-hint">Rechnerische Schätzung, keine medizinische Beratung.</p>
            </>
          )}
        </Row>
      </div>

      {loading && <SkeletonList rows={2} />}

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
    <div className="prof-info">
      <div className="prof-info-k">{label}</div>
      <div className="prof-info-v">{text}</div>
    </div>
  );
}

function ResultTile({ metricKey, value, unit, note, onInfo, wide = false }) {
  return (
    <div className={`prof-tile${wide ? ' prof-tile--wide' : ''}`}>
      <button className="prof-tile-info" onClick={() => onInfo(metricKey)} aria-label={`Erklärung zu ${METRIC_INFO[metricKey].title}`}>
        <Icon name="info" size={18} />
      </button>
      <div className="prof-tile-k">{METRIC_INFO[metricKey].title}</div>
      <div className="prof-tile-v">
        {typeof value === 'number' ? formatNumber(value, 1) : value}
        {unit && <small>{unit}</small>}
      </div>
      {note && <div className="prof-tile-note">{note}</div>}
    </div>
  );
}
