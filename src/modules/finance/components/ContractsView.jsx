import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import * as db from '../lib/finData';
import {
  formatEur,
  getContractStatus,
  getTemplateStatus,
  intervalLabel,
  monthlyAmount,
  INTERVALS,
} from '../lib/finance';
import RecurringSheet from './RecurringSheet';
import { IconChevron, IconContract, IconFixed, IconIncome, IconPlus } from './ContractIcons';
import { confirmDialog } from '../../../core/components/ui';

const intervalOf = (x) => x.interval ?? (x.quarterly ? 'quarterly' : 'monthly');

// "fällig am 16. · monatlich" / "fällig am 1. · alle 6 Monate"; ohne Tag der Rhythmus
function dueText(x) {
  const iv = intervalOf(x);
  const months = INTERVALS[iv]?.months ?? 1;
  if (x.due_day) return `fällig am ${x.due_day}. · ${months > 1 ? `alle ${months} Monate` : 'monatlich'}`;
  return months > 1 ? intervalLabel(iv) : '';
}

// ── Eintrag als Karte ─────────────────────────────────────────────────────────
// src: 'template' (Einnahme oder Fixkosten) | 'contract'
function EntryCard({ x, src, expired, onClick }) {
  const iv = intervalOf(x);
  // Vertrag = älterer Eintrag aus fin_contracts oder Vorlage mit is_contract (bucht wie Fixkosten)
  const isContract = src === 'contract' || x.is_contract;
  const Icon = isContract ? IconContract : (x.category === 'fixeinnahmen' ? IconIncome : IconFixed);
  const expiring = (src === 'contract' ? getContractStatus(x) : getTemplateStatus(x)) === 'expiring';
  const sub = [dueText(x), isContract ? x.notes : ''].filter(Boolean).join(' · ');

  return (
    <button type="button" className={`vt-card${expired ? ' is-expired' : ''}`} onClick={() => onClick(x)}>
      <span className="vt-ic"><Icon /></span>
      <span className="vt-body">
        <span className="vt-top">
          <b className="vt-name">{x.name}</b>
          {x.payment ? <span className="vt-pay">{x.payment}</span> : null}
          {expiring ? <span className="vt-flag">Läuft aus</span> : null}
        </span>
        {sub ? <span className="vt-sub">{sub}</span> : null}
      </span>
      <span className="vt-amt">
        <b>{formatEur(x.amount)}</b>
        {iv !== 'monthly' ? <small>≈ {formatEur(monthlyAmount(x.amount, iv))}/Mo.</small> : null}
      </span>
    </button>
  );
}

// Eingeklappte Abgelaufene
function ExpiredToggle({ count, open, onToggle }) {
  return (
    <button type="button" className="vt-card vt-more" onClick={onToggle} aria-expanded={open}>
      <span className="vt-ic vt-ic--quiet"><IconChevron open={open} /></span>
      <span className="vt-body">
        <b className="vt-name">Abgelaufen</b>
        <span className="vt-sub">{count} {count === 1 ? 'Eintrag' : 'Einträge'}</span>
      </span>
    </button>
  );
}

function AddCard({ label, onClick }) {
  return (
    <button type="button" className="vt-add" onClick={onClick}>
      <IconPlus />{label}
    </button>
  );
}

// ── Einnahmen ─────────────────────────────────────────────────────────────────
function EinnahmenSection({ templates, onEdit, onAdd }) {
  const [expiredOpen, setExpiredOpen] = useState(false);

  const items   = templates.filter((t) => t.category === 'fixeinnahmen');
  const active  = items.filter((t) => getTemplateStatus(t) !== 'expired');
  const expired = items.filter((t) => getTemplateStatus(t) === 'expired');
  const totalMonthly = active.reduce((s, t) => s + monthlyAmount(t.amount, intervalOf(t)), 0);

  return (
    <section className="vt-group">
      <header className="vt-gh">
        <h2>Einnahmen</h2>
        {active.length > 0 ? <span>{formatEur(totalMonthly)} / Monat</span> : null}
      </header>
      <div className="vt-list">
        {items.length === 0 && <p className="vt-empty">Noch keine Einnahmequellen angelegt.</p>}
        {active.map((t) => <EntryCard key={t.id} x={t} src="template" onClick={onEdit} />)}
        {expired.length > 0 && (
          <>
            <ExpiredToggle count={expired.length} open={expiredOpen} onToggle={() => setExpiredOpen((o) => !o)} />
            {expiredOpen && expired.map((t) => <EntryCard key={t.id} x={t} src="template" expired onClick={onEdit} />)}
          </>
        )}
        <AddCard label="Einnahme hinzufügen" onClick={onAdd} />
      </div>
    </section>
  );
}

// ── Fixkosten & Verträge ──────────────────────────────────────────────────────
function FixkostenSection({ templates, contracts, onEditTemplate, onEditContract, onAdd }) {
  const [expiredOpen, setExpiredOpen] = useState(false);

  const allItems = [
    ...templates.filter((t) => t.category === 'fixkosten').map((t) => ({ src: 'template', x: t })),
    ...contracts.map((c) => ({ src: 'contract', x: c })),
  ];
  const statusOf = ({ src, x }) => (src === 'template' ? getTemplateStatus(x) : getContractStatus(x));
  const active  = allItems.filter((i) => statusOf(i) !== 'expired');
  const expired = allItems.filter((i) => statusOf(i) === 'expired');
  const expiringSoon = active.filter((i) => statusOf(i) === 'expiring').length;
  const totalMonthly = active.reduce((s, { x }) => s + monthlyAmount(x.amount, intervalOf(x)), 0);

  const renderItem = (i, isExpired) => (
    <EntryCard
      key={`${i.src}-${i.x.id}`} x={i.x} src={i.src} expired={isExpired}
      onClick={i.src === 'template' ? onEditTemplate : onEditContract}
    />
  );

  return (
    <section className="vt-group">
      <header className="vt-gh">
        <h2>Fixkosten &amp; Verträge</h2>
        {active.length > 0 ? <span>{formatEur(totalMonthly)} / Monat</span> : null}
      </header>
      {active.length > 0 && (
        <p className="vt-meta">
          {active.length} aktiv{expiringSoon > 0 ? ` · ${expiringSoon} läuft aus` : ''} · {formatEur(totalMonthly * 12)} pro Jahr
        </p>
      )}
      <div className="vt-list">
        {allItems.length === 0 && <p className="vt-empty">Noch keine Einträge angelegt.</p>}
        {active.map((i) => renderItem(i, false))}
        {expired.length > 0 && (
          <>
            <ExpiredToggle count={expired.length} open={expiredOpen} onToggle={() => setExpiredOpen((o) => !o)} />
            {expiredOpen && expired.map((i) => renderItem(i, true))}
          </>
        )}
        <AddCard label="Fixkosten oder Vertrag hinzufügen" onClick={onAdd} />
      </div>
    </section>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function ContractsView() {
  const { session }   = useAuth();
  const { showToast } = useUi();

  const [templates, setTemplates] = useState([]);
  const [contracts, setContracts] = useState([]);
  // Fenster: { kind, choose, item, itemType } — null = zu
  const [sheet, setSheet] = useState(null);

  const now = new Date();

  const load = useCallback(async () => {
    const [tpls, ctrts] = await Promise.all([
      db.getFixTemplates(session),
      db.getContracts(session),
    ]);
    tpls.sort((a, b) => a.name.localeCompare(b.name));
    setTemplates(tpls);
    setContracts(ctrts.sort((a, b) => a.name.localeCompare(b.name)));
  }, [session]);

  useEffect(() => { load(); }, [load]);

  // Fehler beim Speichern/Löschen: Fenster bleibt offen, Meldung statt stillem Promise-Fehler.
  async function run(action, okText, failText) {
    try {
      await action();
    } catch (err) {
      console.error('[Verträge]', err);
      showToast(failText);
      return;
    }
    setSheet(null);
    showToast(okText);
    load();
  }

  async function handleSaveTemplate(input) {
    // legacyContractId: älterer Vertrag aus fin_contracts, der jetzt als Vorlage gespeichert wird
    const { legacyContractId, ...tpl } = input;
    const isNew = !tpl.id;
    let saved;
    try {
      saved = await db.saveFixTemplate(session, tpl);
      if (legacyContractId) await db.deleteContract(legacyContractId);
    } catch (err) {
      console.error('[Verträge]', err);
      showToast('Speichern fehlgeschlagen');
      return;
    }
    if (isNew) {
      try {
        await db.applyNewTemplateEverywhere(session, saved, now.getFullYear(), now.getMonth() + 1);
      } catch (err) {
        // Die Vorlage steht schon in der Datenbank: Fenster schließen, sonst legt ein
        // zweiter Klick auf "Speichern" eine doppelte Vorlage an.
        console.error('[Verträge]', err);
        setSheet(null);
        showToast('Gespeichert, Übernahme in die Monate fehlgeschlagen');
        load();
        return;
      }
    }
    setSheet(null);
    if (tpl.is_contract) showToast(isNew ? 'Vertrag hinzugefügt' : 'Vertrag aktualisiert');
    else showToast(isNew ? 'Posten hinzugefügt' : 'Posten aktualisiert');
    load();
  }

  async function handleDeleteTemplate(id) {
    if (!(await confirmDialog({ title: 'Posten löschen?', text: 'Bereits übernommene Monatswerte bleiben erhalten.' }))) return;
    await run(() => db.deleteFixTemplate(session, id), 'Posten gelöscht', 'Löschen fehlgeschlagen');
  }

  async function handleDeleteContract(id) {
    if (!(await confirmDialog({ title: 'Vertrag löschen?' }))) return;
    await run(() => db.deleteContract(id), 'Vertrag gelöscht', 'Löschen fehlgeschlagen');
  }

  return (
    <div className="vt-page">
      <EinnahmenSection
        templates={templates}
        onEdit={(t) => setSheet({ item: t, itemType: 'template' })}
        onAdd={() => setSheet({ kind: 'einnahme' })}
      />

      <FixkostenSection
        templates={templates}
        contracts={contracts}
        onEditTemplate={(t) => setSheet({ item: t, itemType: 'template' })}
        onEditContract={(c) => setSheet({ item: c, itemType: 'contract' })}
        onAdd={() => setSheet({ kind: 'fixkosten', choose: true })}
      />

      {sheet && (
        <RecurringSheet
          key={sheet.item?.id || sheet.kind}
          kind={sheet.kind}
          choose={sheet.choose}
          item={sheet.item}
          itemType={sheet.itemType}
          currentMonth={now.getMonth() + 1}
          currentYear={now.getFullYear()}
          onSaveTemplate={handleSaveTemplate}
          onDelete={sheet.itemType === 'contract' ? handleDeleteContract : handleDeleteTemplate}
          onClose={() => setSheet(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
