// src/modules/shopping/components/CompleteListSheet.jsx
// "Einkauf abschließen" in bis zu drei Schritten (siehe CLAUDE.md):
//   1. Alles gefunden?    gekauft (im Warenkorb) / noch offen, ein Tipp stellt um
//   2. Nicht gefunden     nur wenn Artikel offen sind: alle gemeinsam auf eine bestehende oder
//                         neue Liste übertragen — oder verwerfen (löschen)
//   3. Bezahlung          Zahlungen erfassen (mehrere möglich), Buchung in den Finanzen
// Geschrieben wird erst ganz am Ende ("Buchen & abschließen" / "Ohne Buchung abschließen").
// Reihenfolge dort: Markierungen → offene Artikel übertragen/verwerfen → Zahlungen → Buchung → Status.
// Danach eine Zusammenfassung; "Fertig" geht zurück in die Übersicht.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SheetShell from '../../../core/components/SheetShell.jsx';
import { WheelPicker, WizardFoot, WizardFrame } from '../../../core/components/wizard/WizardKit.jsx';
import { IconCheck, IconTrash } from '../../../core/components/Icons.jsx';
import { fb } from '../../../core/lib/feedback';
import { formatEur } from '../../../core/lib/format.js';
import { createShoppingExpense } from '../../../core/lib/financeBridge.js';
import {
  loadLists, loadItems, saveList, toggleItemDone, deleteItems, applyShoppingPlan,
  loadPayments, savePayment, deletePayment, updateListStatus, linkListFinEntry, releaseListBooking,
  saveListAsTemplate,
} from '../lib/shoData.js';
import { PAYMENT_METHODS, INSTANT_PAYMENT_METHODS } from '../lib/data/stores.js';
import { STORE_NAMES } from '../lib/data/items.js';
import { fmtAmount, planTransfer, transferHint } from '../lib/recipeImport.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const qtyLabel = (it) => (it.quantity != null || it.unit ? fmtAmount(it.quantity, it.unit) : '');

// Zahlungsart einer Buchung: die Methode mit dem höchsten Anteil der Teilliste.
function dominantMethod(list) {
  if (!list.length) return 'Bar';
  const sums = {};
  for (const p of list) sums[p.payment] = (sums[p.payment] || 0) + (Number(p.amount) || 0);
  return Object.entries(sums).sort((a, b) => b[1] - a[1])[0][0];
}
const sumOf = (list) => round2(list.reduce((s, p) => s + (Number(p.amount) || 0), 0));

// Notiz der Buchung: eine Zahlung → ihre eigene Notiz, mehrere → Aufschlüsselung.
function noteFor(list) {
  if (list.length === 0) return null;
  if (list.length === 1) return list[0].note || null;
  return list
    .map((p) => {
      const base = `${formatEur(p.amount)} ${p.payment}${p.store_name ? ` (${p.store_name})` : ''}`;
      return p.note ? `${base} – ${p.note}` : base;
    })
    .join(' · ');
}

const EMPTY_FORM = { amount: '', payment: 'Bar', store_name: '', note: '' };

export default function CompleteListSheet({ list, items, onClose, onFinished }) {
  const [stepIdx,  setStepIdx]  = useState(0);
  const [doneMap,  setDoneMap]  = useState(() => Object.fromEntries(items.map((i) => [i.id, !!i.done])));
  const [lists,    setLists]    = useState(null);          // andere offene Listen (null = lädt)
  const [target,   setTarget]   = useState(null);          // Listen-Id | 'new' | 'discard'
  const [newName,  setNewName]  = useState(`Rest von ${list.name}`);
  const [targetOpen, setTargetOpen] = useState([]);        // offene Artikel der Zielliste (für Hinweise)
  const [payments, setPayments] = useState([]);
  const [removed,  setRemoved]  = useState([]);            // ids bereits gespeicherter, entfernter Zahlungen
  const [form,     setForm]     = useState(null);
  const [booking,  setBooking]  = useState(list.name);
  const [saveTmpl, setSaveTmpl]   = useState(false);     // "Als Vorlage speichern" (Schritt 3)
  const [tmplName, setTmplName]   = useState(list.name);
  const [tmplRemoved, setTmplRemoved] = useState({});     // im Fenster "Artikel ansehen" entfernte Artikel (gilt nur für die Vorlage)
  const [tmplPopup, setTmplPopup] = useState(false);
  const tmplDone = useRef(false);                          // nicht doppelt anlegen, falls ein späterer Schritt scheitert und man es erneut versucht
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [result,   setResult]   = useState(null);

  const open = useMemo(() => items.filter((i) => !doneMap[i.id]), [items, doneMap]);
  const bought = items.length - open.length;
  // Artikel der Vorlage: die gekauften, abzüglich der im Fenster entfernten
  const tmplItems = useMemo(() => items.filter((i) => doneMap[i.id] && !tmplRemoved[i.id]), [items, doneMap, tmplRemoved]);
  const steps = open.length > 0 ? ['check', 'open', 'pay'] : ['check', 'pay'];
  const key = steps[Math.min(stepIdx, steps.length - 1)];

  // Andere offene Listen + schon erfasste Zahlungen dieser Liste
  useEffect(() => {
    let alive = true;
    loadLists()
      .then((all) => {
        if (!alive) return;
        const others = all.filter((l) => l.id !== list.id && (l.status || 'offen') !== 'erledigt');
        setLists(others);
        setTarget(others.length > 0 ? others[0].id : 'new');
      })
      .catch(() => { if (alive) { setLists([]); setTarget('new'); } });
    loadPayments(list.id)
      .then((p) => { if (alive) setPayments(p); })
      .catch(() => {});
    return () => { alive = false; };
  }, [list.id]);

  // Offene Artikel der gewählten Zielliste
  useEffect(() => {
    if (!target || target === 'new' || target === 'discard') { setTargetOpen([]); return undefined; }
    let alive = true;
    loadItems(target)
      .then((all) => { if (alive) setTargetOpen(all.filter((i) => !i.done)); })
      .catch(() => { if (alive) setTargetOpen([]); });
    return () => { alive = false; };
  }, [target]);

  const total = sumOf(payments);
  const instant = sumOf(payments.filter((p) => INSTANT_PAYMENT_METHODS.includes(p.payment)));
  const pending = sumOf(payments.filter((p) => !INSTANT_PAYMENT_METHODS.includes(p.payment)));

  // Läden für den Regler: schon in der Liste genutzte zuerst, dann alle bekannten
  const storeItems = useMemo(() => {
    const used = [...new Set(items.map((i) => i.item_store_name).filter(Boolean))].sort();
    const rest = STORE_NAMES.filter((n) => !used.includes(n));
    return [{ value: '', label: 'Kein Laden' }, ...used.map((n) => ({ value: n, label: n })), ...rest.map((n) => ({ value: n, label: n }))];
  }, [items]);

  const targetName = target === 'new'
    ? (newName.trim() || `Rest von ${list.name}`)
    : (lists || []).find((l) => l.id === target)?.name || '';

  function toggle(id) { setDoneMap((m) => ({ ...m, [id]: !m[id] })); }

  function savePaymentForm() {
    const amount = round2(parseFloat(String(form.amount).replace(',', '.')));
    if (!(amount > 0)) { setError('Bitte einen gültigen Betrag eingeben.'); return; }
    setError('');
    setPayments((p) => [...p, { amount, payment: form.payment, store_name: form.store_name.trim() || null, note: form.note.trim() || null }]);
    setForm(null);
    fb.paymentCheck?.();
  }

  function removePayment(idx) {
    const p = payments[idx];
    if (p.id) setRemoved((r) => [...r, p.id]);
    setPayments((all) => all.filter((_, i) => i !== idx));
  }

  async function finish(book) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      // 1) Markierungen
      for (const it of items) {
        if (!!doneMap[it.id] !== !!it.done) {
          // eslint-disable-next-line no-await-in-loop
          await toggleItemDone(it.id, !!doneMap[it.id]);
        }
      }

      // 2) Nicht gekaufte Artikel übertragen oder verwerfen
      const sum = { bought, moved: 0, merged: 0, discarded: 0, newList: false, targetName: '', booked: false };
      if (open.length > 0) {
        if (target === 'discard') {
          await deleteItems(open.map((i) => i.id));
          sum.discarded = open.length;
        } else {
          let targetId = target;
          let existing = [];
          if (target === 'new') {
            const created = await saveList({ name: newName.trim() || `Rest von ${list.name}`, icon: list.icon || '🛒' });
            targetId = created.id; sum.newList = true; sum.targetName = created.name;
          } else {
            sum.targetName = targetName;
            existing = (await loadItems(targetId)).filter((i) => !i.done);
          }
          const plan = planTransfer(open, existing);
          await applyShoppingPlan(targetId, plan, 'list_leftovers_moved');
          await deleteItems(open.map((i) => i.id));
          sum.moved = open.length; sum.merged = plan.merged;
        }
      }

      // Als Vorlage speichern: jetzt, wo nur noch die gekauften Artikel in der Liste stehen.
      // Ein Fehler hier darf den Abschluss nicht verhindern.
      if (saveTmpl && tmplItems.length > 0 && !tmplDone.current) {
        try {
          const tName = tmplName.trim() || list.name;
          await saveListAsTemplate(list.id, tName, list.icon || '🛒', Object.keys(tmplRemoved));
          tmplDone.current = true;
          sum.template = tName;
          sum.templateCount = tmplItems.length;
        } catch (e) {
          console.warn('Vorlage konnte nicht gespeichert werden:', e);
          sum.templateFailed = true;
        }
      }

      // 3) Zahlungen und Buchung
      if (book && total > 0) {
        for (const id of removed) {
          // eslint-disable-next-line no-await-in-loop
          await deletePayment(id);
        }
        setRemoved([]);
        for (const p of payments.filter((x) => !x.id)) {
          // eslint-disable-next-line no-await-in-loop
          const saved = await savePayment({ list_id: list.id, store_name: p.store_name, amount: p.amount, payment: p.payment, note: p.note });
          p.id = saved.id; // bei einem Wiederholungsversuch nicht doppelt speichern
        }

        await releaseListBooking(list.id); // vorhandene Buchung ersetzen statt doppelt buchen
        const inst = payments.filter((p) => INSTANT_PAYMENT_METHODS.includes(p.payment));
        const pend = payments.filter((p) => !INSTANT_PAYMENT_METHODS.includes(p.payment));
        const baseName = booking.trim() || list.name;
        const mixed = sumOf(inst) > 0 && sumOf(pend) > 0;
        let paidId = null; let openId = null;
        if (sumOf(inst) > 0) {
          paidId = (await createShoppingExpense({ name: baseName, amount: sumOf(inst), payment: dominantMethod(inst), note: noteFor(inst), paid: true })).id;
        }
        if (sumOf(pend) > 0) {
          openId = (await createShoppingExpense({ name: mixed ? `${baseName} (offen)` : baseName, amount: sumOf(pend), payment: dominantMethod(pend), note: noteFor(pend), paid: false })).id;
        }
        // Verknüpfung ist "nice to have" (fürs Stornieren beim Wiederöffnen): ein Fehler hier darf den Abschluss nicht verhindern.
        try { await linkListFinEntry(list.id, paidId, openId); } catch (e) { console.warn('Verknüpfung Liste↔Buchung fehlgeschlagen:', e); }
        Object.assign(sum, { booked: true, total, name: baseName, split: mixed, onlyOpen: pend.length > 0 && inst.length === 0 });
      }

      await updateListStatus(list.id, 'erledigt');
      fb.listStatusCycle?.();
      setResult(sum);
    } catch (e) {
      console.error('[complete-list]', e);
      setError('Abschluss fehlgeschlagen. Bitte noch einmal versuchen.');
    } finally {
      setBusy(false);
    }
  }

  // ── Zusammenfassung ──
  if (result) {
    return (
      <SheetShell onClose={onFinished} wizard>
        <WizardFrame
          title="Einkauf abgeschlossen"
          sub={list.name}
          onClose={onFinished}
          footer={<WizardFoot one><button type="button" className="btn cl-cta" onClick={onFinished}>Fertig</button></WizardFoot>}
        >
          <div className="cl-result-big" aria-hidden="true"><span><IconCheck /></span></div>
          <div className="cl-rlist">
            <div><i>✓</i><span>{result.bought} {result.bought === 1 ? 'Artikel' : 'Artikel'} gekauft</span></div>
            {result.moved > 0 && (
              <div><i>↗</i><span>{result.moved} Artikel auf „{result.targetName}“ übertragen
                <small>{result.merged ? `${result.merged} davon aufgestockt` : 'als neue Zeilen'}{result.newList ? ' · Liste neu angelegt' : ''}</small></span></div>
            )}
            {result.discarded > 0 && (
              <div><i>🗑</i><span>{result.discarded} Artikel verworfen<small>aus der Liste gelöscht</small></span></div>
            )}
            {result.template && (
              <div><i>📋</i><span>Als Vorlage „{result.template}“ gespeichert<small>{result.templateCount} {result.templateCount === 1 ? 'Artikel' : 'Artikel'} · zu finden unter Plus → Aus Vorlage</small></span></div>
            )}
            {result.templateFailed && (
              <div><i>!</i><span>Vorlage konnte nicht gespeichert werden</span></div>
            )}
            {result.booked ? (
              <div><i>€</i><span>Buchung {formatEur(result.total)} in den Finanzen
                <small>{result.name} · Sonstige Ausgaben{result.split ? ' · zwei Buchungen (bezahlt und offen)' : result.onlyOpen ? ' · offen' : ' · bezahlt'}</small></span></div>
            ) : (
              <div><i>–</i><span>Keine Buchung angelegt</span></div>
            )}
          </div>
        </WizardFrame>
      </SheetShell>
    );
  }

  // ── Schritte ──
  const titles = { check: 'Alles gefunden?', open: 'Nicht gefunden', pay: 'Bezahlung' };

  const row = (it, interactive) => (
    <div key={it.id} className={`cl-row${doneMap[it.id] ? ' done' : ' open'}`}>
      {interactive ? (
        <button type="button" className="cl-row-btn" role="checkbox" aria-checked={!!doneMap[it.id]} onClick={() => toggle(it.id)}>
          <span className={`cl-ck${doneMap[it.id] ? ' on' : ''}`}>{doneMap[it.id] && <IconCheck />}</span>
          <span className="cl-bd"><b>{it.name}</b>{it.note && <small>{it.note}</small>}</span>
          {qtyLabel(it) && <span className="cl-q">{qtyLabel(it)}</span>}
        </button>
      ) : (
        <div className="cl-row-btn">
          <span className="cl-bd">
            <b>{it.name}</b>
            {(() => {
              const h = target && target !== 'new' && target !== 'discard' ? transferHint(it, targetOpen) : null;
              if (h) return <small className="merge">{h}</small>;
              return it.note ? <small>{it.note}</small> : null;
            })()}
          </span>
          {qtyLabel(it) && <span className="cl-q">{qtyLabel(it)}</span>}
        </div>
      )}
    </div>
  );

  let body;
  if (key === 'check') {
    const doneList = items.filter((i) => doneMap[i.id]);
    body = (
      <>
        <div className="cl-sum">
          <span className="n">{bought}/{items.length}</span>
          <span className="t"><b>{open.length ? `${open.length} Artikel noch offen` : 'Alles gekauft'}</b></span>
        </div>
        {open.length > 0 && (<><div className="cl-sec">Noch offen ({open.length})</div><div className="cl-card">{open.map((i) => row(i, true))}</div></>)}
        <div className="cl-sec">Im Warenkorb ({doneList.length})</div>
        {doneList.length > 0
          ? <div className="cl-card">{doneList.map((i) => row(i, true))}</div>
          : <div className="cl-note warn">Nichts gekauft. Du kannst trotzdem abschließen.</div>}
      </>
    );
  } else if (key === 'open') {
    const discard = target === 'discard';
    body = (
      <>
        <div className={`cl-card cl-ocard${discard ? ' dim' : ''}`}>{open.map((i) => row(i, false))}</div>
        <div className="cl-sec">Wohin damit?</div>
        <div className="cl-lists" role="radiogroup" aria-label="Ziel der nicht gekauften Artikel">
          {(lists || []).map((l) => (
            <button key={l.id} type="button" className="cl-lopt" role="radio" aria-checked={target === l.id} onClick={() => setTarget(l.id)}>
              <span className="ic">{l.icon || '🛒'}</span>
              <span className="t"><b>{l.name}</b><small>{(l._total ?? 0) - (l._done ?? 0)} offen</small></span>
              <span className="rd" />
            </button>
          ))}
          <button type="button" className="cl-lopt new" role="radio" aria-checked={target === 'new'} onClick={() => setTarget('new')}>
            <span className="ic">＋</span>
            <span className="t"><b>Neue Liste</b><small>wird beim Abschließen angelegt</small></span>
            <span className="rd" />
          </button>
          <button type="button" className="cl-lopt warn" role="radio" aria-checked={discard} onClick={() => setTarget('discard')}>
            <span className="ic">🗑</span>
            <span className="t"><b>Verwerfen</b><small>nicht mehr gebraucht, wird gelöscht</small></span>
            <span className="rd" />
          </button>
        </div>
        {target === 'new' && (
          <input className="cl-field" style={{ marginTop: 8 }} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} aria-label="Name der neuen Liste" />
        )}
      </>
    );
  } else {
    body = (
      <>
        {payments.length > 0 ? (
          <div className="cl-card">
            {payments.map((p, i) => (
              <div key={p.id || `new-${i}`} className="cl-pay">
                <span className="am">{formatEur(p.amount)}</span>
                <span className="mt">{p.payment}{p.store_name ? ` · ${p.store_name}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
                <button type="button" className="x" onClick={() => removePayment(i)} aria-label="Zahlung löschen">×</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="cl-note warn">Noch keine Zahlung erfasst. Ohne Zahlung schließt „Ohne Buchung abschließen“ nur die Liste.</div>
        )}

        {form ? (
          <div className="cl-form">
            <input
              className="cl-field" inputMode="decimal" placeholder="Betrag (€)" aria-label="Betrag" autoFocus
              value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.,]/g, '') })}
            />
            <div className="cl-flbl">Zahlungsart</div>
            <div className="cl-meth" role="group" aria-label="Zahlungsart">
              {PAYMENT_METHODS.map((m) => (
                <button key={m} type="button" aria-pressed={form.payment === m} onClick={() => setForm({ ...form, payment: m })}>{m}</button>
              ))}
            </div>
            <div className="cl-flbl">Laden <span>optional</span></div>
            <WheelPicker items={storeItems} value={form.store_name} onChange={(v) => setForm({ ...form, store_name: v })} label="Laden" />
            <input
              className="cl-field" placeholder="Notiz (optional)" aria-label="Notiz" maxLength={140}
              value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <div className="cl-fbtns">
              <button type="button" className="cl-sbtn" onClick={() => { setForm(null); setError(''); }}>Abbrechen</button>
              <button type="button" className="cl-sbtn p" onClick={savePaymentForm}>Zahlung speichern</button>
            </div>
          </div>
        ) : (
          <button type="button" className="cl-addpay" onClick={() => setForm({ ...EMPTY_FORM })}>+ Zahlung hinzufügen</button>
        )}

        <div className="cl-gesamt"><span>Gesamt</span><b>{formatEur(total)}</b></div>
        {total > 0 && (
          <>
            <div className="cl-sec">Bezeichnung der Buchung</div>
            <input className="cl-field" value={booking} onChange={(e) => setBooking(e.target.value)} maxLength={80} aria-label="Bezeichnung der Buchung" />
            {pending > 0 && (
              <div className="cl-note">
                {instant > 0 ? 'Es entstehen zwei Buchungen in den Finanzen: eine bezahlte und eine offene.' : 'Die Buchung ist in den Finanzen offen, bis du sie dort abhakst.'}
              </div>
            )}
          </>
        )}

        {bought > 0 && (
          <div className="cl-tmpl">
            <button type="button" className="cl-switch-row" role="switch" aria-checked={saveTmpl} onClick={() => setSaveTmpl((v) => !v)}>
              <span className="t"><b>Als Vorlage speichern</b><small>{bought === 1 ? 'Den gekauften Artikel' : `Die ${bought} gekauften Artikel`} für den nächsten Einkauf merken</small></span>
              <span className="cl-switch" aria-hidden="true"><i /></span>
            </button>
            {saveTmpl && (
              <>
                <label className="cl-flbl" htmlFor="cl-tmpl-name">Name der Vorlage</label>
                <input id="cl-tmpl-name" className="cl-field" value={tmplName} onChange={(e) => setTmplName(e.target.value)} maxLength={60} />
                <button type="button" className="cl-aview" onClick={() => setTmplPopup(true)}>
                  <span>Artikel ansehen</span>
                  <span className="cl-q">{tmplItems.length}</span>
                  <span className="go" aria-hidden="true">›</span>
                </button>
                {tmplItems.length === 0 && <div className="cl-note warn">Keine Artikel in der Vorlage. Es wird keine Vorlage gespeichert.</div>}
              </>
            )}
          </div>
        )}

        {tmplPopup && createPortal(
          <>
            <div className="cl-pop-scrim" onClick={() => setTmplPopup(false)} />
            <div className="cl-pop" role="dialog" aria-modal="true" aria-label="Artikel der Vorlage">
              <div className="cl-pop-h">
                <span className="t"><b>Artikel der Vorlage</b><small>Entfernen gilt nur für die Vorlage, nicht für deine Liste</small></span>
                <button type="button" className="cl-pop-x" onClick={() => setTmplPopup(false)} aria-label="Schließen">✕</button>
              </div>
              <div className="cl-pop-list">
                {tmplItems.length === 0 && <div className="cl-pop-empty">Keine Artikel mehr in der Vorlage.</div>}
                {tmplItems.map((it) => (
                  <div key={it.id} className="cl-prow">
                    <span className="cl-bd"><b>{it.name}</b>{it.note && <small>{it.note}</small>}</span>
                    {qtyLabel(it) && <span className="cl-q">{qtyLabel(it)}</span>}
                    <button type="button" className="cl-trash" onClick={() => setTmplRemoved((r) => ({ ...r, [it.id]: true }))} aria-label={`${it.name} aus der Vorlage entfernen`}>
                      <IconTrash size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="cl-pop-f"><button type="button" className="btn cl-cta" onClick={() => setTmplPopup(false)}>Fertig</button></div>
            </div>
          </>,
          document.body,
        )}
      </>
    );
  }

  let footer;
  if (key === 'pay') {
    footer = (
      <WizardFoot one hint={error}>
        <button type="button" className="btn cl-cta" disabled={busy || total <= 0} onClick={() => finish(true)}>{busy ? 'Wird abgeschlossen …' : 'Buchen & abschließen'}</button>
        <button type="button" className="btn cl-cta2" disabled={busy} onClick={() => finish(false)}>Ohne Buchung abschließen</button>
      </WizardFoot>
    );
  } else if (key === 'open') {
    footer = (
      <WizardFoot one hint={error}>
        <button type="button" className="btn cl-cta" disabled={lists === null} onClick={() => setStepIdx(stepIdx + 1)}>Weiter</button>
      </WizardFoot>
    );
  } else {
    footer = (
      <WizardFoot one>
        <button type="button" className="btn cl-cta" onClick={() => setStepIdx(stepIdx + 1)}>Weiter</button>
      </WizardFoot>
    );
  }

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame
        title={titles[key]}
        step={steps.indexOf(key) + 1}
        total={steps.length}
        stepKey={key}
        onBack={steps.indexOf(key) > 0 ? () => setStepIdx(stepIdx - 1) : undefined}
        onClose={onClose}
        footer={footer}
      >
        {body}
      </WizardFrame>
    </SheetShell>
  );
}
