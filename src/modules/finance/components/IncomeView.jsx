// modules/finance/components/IncomeView.jsx
//
// Seite "Einnahmen" (#/finance/einnahmen): Einnahmen sind von den Ausgaben getrennt und
// hängen an keinem Monat. Oben jede Einnahmequelle mit eigenem Knopf "Eingang bestätigen":
// Fix (jeden Monat am selben Tag): der Knopf erscheint ab dem Tag; Unterschiedlich: immer
// sichtbar. Je Quelle und Kalendermonat nur EINMAL bestätigen — danach steht dort
// "Bestätigt am …" statt des Knopfs. Der Eingang wird auf den Bestätigungstag gebucht
// (normale Einnahme-Buchung, zählt im Eingangsmonat). Regeln: lib/income.js.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import SheetShell from '../../../core/components/SheetShell';
import ActionToast from '../../../core/components/ActionToast';
import { WizardFoot, WizardFrame } from '../../../core/components/wizard/WizardKit';
import { fmtDate, parseMoney } from '../../../core/lib/wizardDates';
import * as finData from '../lib/finData';
import { formatEur, getTemplateStatus, intervalLabel, isSparschweinDirectWithdrawal, localTodayStr } from '../lib/finance';
import {
  available, dueOf, incomeMode, incomeState, isIncomeTemplate, suggestedAmount,
} from '../lib/income';
import RecurringSheet from './RecurringSheet';
import Icon from '../../../core/components/Icon';
import { confirmDialog, Button } from '../../../core/components/ui';

const NF = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}.${m}.${y}`; };
const fmtDs = (s) => { const [, m, d] = String(s).slice(0, 10).split('-'); return `${d}.${m}.`; };
const INCOME = new Set(['fixeinnahmen', 'sonstige_einnahmen']);

function ConfirmSheet({ tpl, entries, today, startIdx, onClose, onDone }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const [value, setValue] = useState(NF.format(suggestedAmount(tpl, entries)));
  const [busy, setBusy] = useState(false);
  const v = parseMoney(value) || 0;
  const cur = available(entries, today, startIdx).verf;

  async function save() {
    if (!(v > 0) || busy) return;
    setBusy(true);
    try {
      // Doppelte Bestätigung (z. B. zweimal getippt) ausschließen: noch einmal frisch prüfen
      const fresh = await finData.getAllEntries(session);
      if (!incomeState(tpl, fresh, today).canConfirm) {
        showToast('Dieser Eingang ist schon bestätigt');
        onClose();
        return;
      }
      const saved = await finData.confirmIncome(session, tpl, Math.round(v * 100) / 100, today);
      onDone(saved, tpl);
    } catch (e) {
      console.error(e);
      showToast('Bestätigen fehlgeschlagen');
      setBusy(false);
    }
  }

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title="Eingang bestätigen"
        sub={tpl.name}
        stepKey={`conf-${tpl.id}`}
        onClose={onClose}
        footer={(
          <WizardFoot>
            <Button variant="secondary" onClick={onClose} disabled={busy}>Abbrechen</Button>
            <Button onClick={save} disabled={!(v > 0) || busy}>{busy ? 'Speichert…' : 'Bestätigen'}</Button>
          </WizardFoot>
        )}
      >
        <label className="wz-lbl" htmlFor="inc-amt">Betrag</label>
        <div className="wz-amount">
          <input
            id="inc-amt" type="text" inputMode="decimal" autoComplete="off" value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          <span>€</span>
        </div>
        {incomeMode(tpl) === 'varies' && <p className="wz-hint">Betrag und Tag schwanken: bitte den echten Betrag eintragen.</p>}
        <div className="wz-lbl">Eingegangen am</div>
        <div className="wz-datebtn inc-fixed">{fmtDate(today)}</div>
        <p className="inc-note">
          Der Eingang wird auf <b>heute</b> gebucht, unabhängig vom Monat. Der aktuelle Stand steigt von {formatEur(cur)} auf <b>{formatEur(cur + (v > 0 ? v : 0))}</b>.
        </p>
      </WizardFrame>
    </SheetShell>
  );
}

export default function IncomeView() {
  const { session } = useAuth();
  const { showToast } = useUi();
  const { version, notifySaved } = useEntrySheet();
  const [templates, setTemplates] = useState([]);
  const [entries, setEntries] = useState([]);
  const [startIdx, setStartIdx] = useState(-Infinity);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // Vorlage
  const [sheet, setSheet] = useState(null); // { item } bearbeiten, {} neu
  const [undo, setUndo] = useState(null); // { id, title }
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  const today = localTodayStr();
  const now = new Date();

  const load = useCallback(async () => {
    try {
      const [ts, es, st] = await Promise.all([finData.getFixTemplates(sessionRef.current), finData.getAllEntries(sessionRef.current), finData.getFinStartIdx(sessionRef.current, localTodayStr())]);
      setStartIdx(st);
      setTemplates(ts.filter(isIncomeTemplate).sort((a, b) => a.name.localeCompare(b.name)));
      setEntries(es);
    } catch (e) {
      console.error(e);
      showToast('Laden fehlgeschlagen');
    }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load, version]);

  const active = templates.filter((t) => getTemplateStatus(t) !== 'expired');
  const history = entries
    // Sparschwein-Entnahmen sind Umbuchungen, keine Eingänge
    .filter((e) => INCOME.has(e.category) && !e.deleted_at && !isSparschweinDirectWithdrawal(e) && dueOf(e) <= today)
    .sort((a, b) => (dueOf(a) < dueOf(b) ? 1 : -1))
    .slice(0, 8);

  async function undoConfirm(id) {
    try {
      await finData.undoIncome(id);
      notifySaved();
      showToast('Rückgängig gemacht');
    } catch (e) {
      console.error(e);
      showToast('Rückgängig fehlgeschlagen');
    }
  }

  async function saveTemplate(tpl) {
    try {
      await finData.saveFixTemplate(session, tpl);
    } catch (e) {
      console.error(e);
      showToast('Speichern fehlgeschlagen');
      return;
    }
    setSheet(null);
    showToast(tpl.id ? 'Einnahme aktualisiert' : 'Einnahme hinzugefügt');
    notifySaved();
    load();
  }

  async function deleteTemplate(id) {
    if (!(await confirmDialog({ title: 'Einnahme löschen?', text: 'Bestätigte Eingänge bleiben erhalten.' }))) return;
    try {
      await finData.deleteFixTemplate(session, id);
    } catch (e) {
      console.error(e);
      showToast('Löschen fehlgeschlagen');
      return;
    }
    setSheet(null);
    showToast('Einnahme gelöscht');
    load();
  }

  return (
    <div className="inc-page">
      <div className="inc-sec"><b>Einnahmequellen</b></div>
      {!loading && active.length === 0 && <p className="inc-empty">Noch keine Einnahme angelegt.</p>}
      {active.map((t) => {
        const st = incomeState(t, entries, today);
        const mode = incomeMode(t);
        let chip = null;
        if (st.state === 'confirmed') chip = { tone: 'ok', text: `eingegangen ${fmtDs(dueOf(st.entry))}` };
        else if (st.state === 'waiting') chip = { tone: 'wait', text: `erwartet ${fmtDs(st.next)}` };
        else if (st.late) chip = { tone: 'late', text: `erwartet seit ${fmtDs(st.next)}` };
        else if (st.state === 'inactive') chip = { tone: 'wait', text: 'gilt nicht diesen Monat' };
        return (
          <div key={t.id} className="inc-card">
            <button type="button" className="inc-edit" onClick={() => setSheet({ item: t })} aria-label={`${t.name} bearbeiten`}>
              <span className="inc-card-h"><b>{t.name}</b>{chip && <em className={`inc-chip inc-chip--${chip.tone}`}>{chip.text}</em>}</span>
              <span className="inc-card-m">{mode === 'fix' ? `Jeden Monat am ${t.due_day}.` : 'Unterschiedlich'}{intervalLabel(t.interval ?? 'monthly') !== 'Monatlich' ? ` · ${intervalLabel(t.interval)}` : ''}</span>
            </button>
            <div className="inc-card-a">
              <span className="inc-amt">≈ {formatEur(suggestedAmount(t, entries))}</span>
              {st.canConfirm ? (
                <button type="button" className="inc-conf" onClick={() => setConfirm(t)}>Eingang bestätigen</button>
              ) : st.state === 'confirmed' ? (
                <span className="inc-done">Bestätigt am {fmtD(dueOf(st.entry))}</span>
              ) : null}
            </div>
            {st.state === 'confirmed' && st.next && <div className="inc-next">Nächster Eingang erwartet ≈ {fmtD(st.next)}</div>}
            {st.state === 'waiting' && <div className="inc-next">Der Knopf erscheint am {fmtD(st.next)}.</div>}
          </div>
        );
      })}
      <button type="button" className="inc-add" onClick={() => setSheet({})}><span aria-hidden="true"><Icon name="plus" size={null} className="glyph" /></span>Einnahme hinzufügen</button>

      <div className="inc-sec"><b>Eingänge</b><span>{history.length}</span></div>
      <div className="inc-hist">
        {history.length === 0 && <p className="inc-empty">Noch keine Eingänge.</p>}
        {history.map((e) => (
          <div key={e.id} className="inc-hrow">
            <span><b>{e.name}</b><small>{fmtD(dueOf(e))}</small></span>
            <b className="inc-plus">+ {NF.format(Number(e.amount))}</b>
          </div>
        ))}
      </div>

      {confirm && (
        <ConfirmSheet
          tpl={confirm}
          entries={entries}
          today={today}
          startIdx={startIdx}
          onClose={() => setConfirm(null)}
          onDone={(saved, tpl) => {
            setConfirm(null);
            notifySaved();
            load();
            setUndo({ id: saved.id, key: `${saved.id}-${Date.now()}`, title: `${tpl.name} ${formatEur(Number(saved.amount))} eingegangen` });
          }}
        />
      )}
      {sheet && (
        <RecurringSheet
          key={sheet.item?.id || 'neu'}
          kind="einnahme"
          item={sheet.item}
          itemType={sheet.item ? 'template' : null}
          currentMonth={now.getMonth() + 1}
          currentYear={now.getFullYear()}
          onSaveTemplate={saveTemplate}
          onDelete={deleteTemplate}
          onClose={() => setSheet(null)}
          showToast={showToast}
        />
      )}
      {undo && (
        <ActionToast
          key={undo.key}
          className="action-toast--fin"
          title={undo.title}
          duration={10000}
          actions={[{ label: 'Rückgängig machen', primary: true, onPress: () => undoConfirm(undo.id) }]}
          onClose={() => setUndo(null)}
        />
      )}
    </div>
  );
}
