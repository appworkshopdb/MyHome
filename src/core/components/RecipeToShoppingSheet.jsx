import { useEffect, useMemo, useState } from 'react';
import SheetShell from './SheetShell';
import { Stepper, WizardFoot, WizardFrame } from './wizard/WizardKit';
import {
  loadLists, loadItems, saveList, deleteList, pickActiveList,
  applyShoppingPlan, undoShoppingPlan,
} from '../../modules/shopping/lib/shoData';
import { markFreshItems } from '../lib/shoppingHandoff';
import { recipeRows, planImport, mergeHint, fmtAmount } from '../../modules/shopping/lib/recipeImport';
import { fb } from '../lib/feedback';

// „Zutaten auf die Liste“ — Rezept-Zutaten (umgerechnet auf die gewählten
// Portionen) in eine Einkaufsliste übernehmen. Wird vom Rezept-Dialog der
// Ernährung geöffnet (Ernährung und Einkauf importieren sich nicht gegenseitig,
// deshalb liegt das Sheet in core/ — wie ShoppingQuickSheet).
//
// Ablauf: Liste wählen (vorgewählt: aktive Liste, oder neue Liste) → Zutaten an-
// und abwählen → hinzufügen. Zutaten, die schon offen auf der Liste stehen,
// werden aufgestockt statt doppelt angelegt. Meist-im-Haus-Zutaten (Salz, Öl,
// Gewürze) sind nicht vorgewählt.
//
// onDone({ count, fresh, merged, listId, listName, undo }) → der Aufrufer zeigt
// den Hinweis mit „Rückgängig“ / „Liste öffnen“; undo() macht genau diese
// Änderung rückgängig (auch eine dafür angelegte Liste).

const NEW = 'new';
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export default function RecipeToShoppingSheet({ recipe, foodsById, initialPortions, onClose, onDone }) {
  const [portions, setPortions] = useState(initialPortions || recipe.servings || 1);
  const [lists, setLists]       = useState(null);   // null = lädt
  const [listKey, setListKey]   = useState(null);   // Listen-Id oder NEW
  const [openItems, setOpenItems] = useState([]);
  const [picked, setPicked]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const rows = useMemo(() => recipeRows(recipe, foodsById, portions), [recipe, foodsById, portions]);

  // Vorauswahl: alles außer Meist-im-Haus (einmalig; die Zeilen-Schlüssel bleiben bei anderen Portionen gleich)
  useEffect(() => {
    const init = {};
    recipeRows(recipe, foodsById, 1).forEach((r) => { init[r.key] = !r.basic; });
    setPicked(init);
  }, [recipe, foodsById]);

  // Listen laden, aktive Liste vorwählen
  useEffect(() => {
    let alive = true;
    loadLists()
      .then((all) => {
        if (!alive) return;
        const usable = all.filter((l) => (l.status || 'offen') !== 'erledigt');
        setLists(usable);
        setListKey(pickActiveList(usable)?.id ?? NEW);
      })
      .catch(() => { if (alive) { setLists([]); setListKey(NEW); setError('Listen konnten nicht geladen werden.'); } });
    return () => { alive = false; };
  }, []);

  // Offene Artikel der gewählten Liste (für die Hinweise „steht schon drauf“)
  useEffect(() => {
    if (!listKey || listKey === NEW) { setOpenItems([]); return undefined; }
    let alive = true;
    loadItems(listKey)
      .then((items) => { if (alive) setOpenItems(items.filter((i) => !i.done)); })
      .catch(() => { if (alive) setOpenItems([]); });
    return () => { alive = false; };
  }, [listKey]);

  const main   = rows.filter((r) => !r.basic);
  const basics = rows.filter((r) => r.basic);
  const chosen = useMemo(() => rows.filter((r) => picked[r.key]), [rows, picked]);
  const plan   = useMemo(() => planImport(chosen, openItems, recipe.name), [chosen, openItems, recipe.name]);
  const fresh  = plan.adds.length;
  const merged = plan.updates.length;
  const total  = chosen.length;
  const listName = listKey === NEW ? recipe.name : (lists || []).find((l) => l.id === listKey)?.name || '';

  const toggle = (key) => setPicked((p) => ({ ...p, [key]: !p[key] }));

  async function submit() {
    if (!total || saving || !listKey) return;
    setSaving(true); setError('');
    let listId = listKey;
    let createdList = false;
    try {
      if (listKey === NEW) {
        const l = await saveList({ name: recipe.name, icon: '🛒' });
        listId = l.id; createdList = true;
      }
      // Frisch lesen: zwischen Öffnen des Sheets und jetzt kann sich die Liste geändert haben
      const current = listId === listKey ? (await loadItems(listId)).filter((i) => !i.done) : [];
      const finalPlan = planImport(chosen, current, recipe.name);
      const result = await applyShoppingPlan(listId, finalPlan);

      const marks = {};
      result.insertedIds.forEach((id) => { marks[id] = 'new'; });
      result.updates.forEach((u) => { marks[u.id] = 'merged'; });
      markFreshItems(marks);
      fb.itemAdd?.();

      onDone?.({
        count: finalPlan.adds.length + finalPlan.updates.length,
        fresh: finalPlan.adds.length,
        merged: finalPlan.updates.length,
        listId, listName,
        undo: async () => {
          await undoShoppingPlan(result);
          if (createdList) await deleteList(listId);
          markFreshItems(null);
        },
      });
      onClose();
    } catch (e) {
      console.error('[recipe-to-shopping]', e);
      // Eine dafür neu angelegte, leere Liste nicht liegen lassen
      if (createdList) deleteList(listId).catch(() => {});
      setError('Hinzufügen fehlgeschlagen. Bitte noch einmal versuchen.');
      setSaving(false);
    }
  }

  function pickRow(r) {
    const on = !!picked[r.key];
    const hint = listKey && listKey !== NEW ? mergeHint(r, openItems) : null;
    return (
      <button key={r.key} type="button" className="rts-pick" role="checkbox" aria-checked={on} onClick={() => toggle(r.key)}>
        <span className="rts-box">{on ? <CheckIcon /> : null}</span>
        <span className="rts-nm">
          <b>{r.name}</b>
          {hint
            ? <small className="merge">steht schon drauf: {hint.from} → {hint.to}</small>
            : <small>{r.category}</small>}
        </span>
        <span className="rts-am">{fmtAmount(r.amount, r.unit)}</span>
      </button>
    );
  }

  const summary = !total
    ? 'Wähle mindestens eine Zutat.'
    : listKey === NEW
      ? `Legt die Liste „${recipe.name}“ mit ${total} ${total === 1 ? 'Artikel' : 'Artikeln'} an`
      : `${fresh} neu${merged ? ` · ${merged} aufgestockt` : ''} auf „${listName}“`;

  const footer = (
    <WizardFoot one hint={error || summary}>
      <button type="button" className="btn rts-cta" disabled={!total || saving || lists === null} onClick={submit}>
        {saving ? 'Wird hinzugefügt …' : !total ? 'Nichts ausgewählt' : `${total} ${total === 1 ? 'Zutat' : 'Zutaten'} hinzufügen`}
      </button>
    </WizardFoot>
  );

  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame title="Zutaten auf die Liste" sub={recipe.name} onClose={onClose} footer={footer}>
        <div className="rts-portions">
          <span className="wz-lbl" style={{ margin: 0 }}>Portionen</span>
          <Stepper value={portions} onChange={setPortions} min={1} max={99} />
        </div>

        <div className="wz-lbl">Auf welche Liste?</div>
        {lists === null ? (
          <div className="rts-muted">Listen werden geladen …</div>
        ) : (
          <div className="rts-lists" role="radiogroup" aria-label="Einkaufsliste">
            {lists.map((l) => {
              const open = (l._total ?? 0) - (l._done ?? 0);
              return (
                <button key={l.id} type="button" className="rts-list" role="radio" aria-checked={listKey === l.id} onClick={() => setListKey(l.id)}>
                  <span className="rts-ic">{l.icon || '🛒'}</span>
                  <span className="rts-nm"><b>{l.name}</b><small>{open} offen{l.id === pickActiveList(lists)?.id ? ' · aktive Liste' : ''}</small></span>
                  <span className="rts-radio" />
                </button>
              );
            })}
            <button type="button" className="rts-list" role="radio" aria-checked={listKey === NEW} onClick={() => setListKey(NEW)}>
              <span className="rts-ic">＋</span>
              <span className="rts-nm"><b>Neue Liste „{recipe.name}“</b><small>Neue Liste anlegen</small></span>
              <span className="rts-radio" />
            </button>
          </div>
        )}

        {main.length > 0 && (
          <>
            <div className="wz-lbl">Einkaufen ({main.length})</div>
            <div className="rts-group">{main.map(pickRow)}</div>
          </>
        )}
        {basics.length > 0 && (
          <>
            <div className="wz-lbl">Meist im Haus</div>
            <div className="rts-group">{basics.map(pickRow)}</div>
          </>
        )}
        {rows.length === 0 && <div className="rts-muted">Dieses Rezept hat keine Zutaten mit Mengen.</div>}
      </WizardFrame>
    </SheetShell>
  );
}
