// modules/finance/components/OverviewSection.jsx
// Modul-Übersicht für Finanzen — passt ohne Scrollen auf einen Screen.
// Monatsnavigation entfernt — Übersicht zeigt immer den aktuellen Monat.
// Navigation durch vergangene Monate nur noch in Buchungen (MonthsView).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import { snapshotGet, snapshotSet } from '../../../core/lib/snapshotCache';
import * as db from '../lib/finData';
import {
  MONTHS_DE,
  formatEur,
  sumCat,
  getContractStatus,
  getTemplateStatus,
  isSparschweinDeposit,
  isSparschweinDirectWithdrawal,
  openAmount,
  isOpenExpense,
  isIncomePending,
  isListedEntry,
  localTodayStr,
} from '../lib/finance';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';
import AreaIcon from '../../../core/components/AreaIcons.jsx';
import SparschweinSection from './SparschweinSection.jsx';
import SpendDonut from './SpendDonut.jsx';
import { available, dedupeIncome } from '../lib/income';
import AvailableCard from '../../../core/components/AvailableCard.jsx';
import { standSummary } from '../../../core/lib/finAvailable.js';
import Icon from '../../../core/components/Icon';

const EXPENSE_CATS = new Set(['fixkosten', 'variable_kosten', 'sonstige_ausgaben']);
const SPEND_CATS = [
  { key: 'fixkosten',         label: 'Fixkosten',       tone: 'a' },
  { key: 'variable_kosten',   label: 'Variable Kosten', tone: 'b' },
  { key: 'sonstige_ausgaben', label: 'Sonstiges',       tone: 'c' },
];

export default function OverviewSection({ onNavigate }) {
  const { session } = useAuth();
  const { version } = useEntrySheet();

  // Immer aktueller Monat — kein State nötig
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  // Beim Wiederbetreten des Moduls sofort den zuletzt gesehenen Stand zeigen
  // (core/lib/snapshotCache.js) und danach im Hintergrund aktualisieren.
  const uid  = session?.user?.id;
  const snap = snapshotGet(uid, `fin:overview:${year}-${month}`);

  const [entries,   setEntries]   = useState(snap?.entries ?? []);
  const [templates, setTemplates] = useState(snap?.templates ?? []);
  const [contracts, setContracts] = useState(snap?.contracts ?? []);
  const [allEntries, setAllEntries] = useState(snap?.allEntries ?? []);
  const [startIdx, setStartIdx] = useState(snap?.startIdx ?? -Infinity);
  const [loading,   setLoading]   = useState(!snap);
  const hasData = useRef(Boolean(snap)); // schon etwas anzuzeigen → kein Ladezustand beim Aktualisieren

  // useRef-Muster: session-Objekt ändert sich nicht pro Render → load bleibt stabil
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const load = useCallback(async () => {
    if (!hasData.current) setLoading(true);
    try {
      const s = sessionRef.current;
      // Alles in EINER Runde laden. Fehlende Fixkosten-Vorlagen werden danach aus
      // diesen Daten berechnet (vorher: zwei zusätzliche Abfragen davor); nur wenn
      // etwas angelegt wurde (selten, z. B. erster Aufruf im Monat), lädt es die
      // Posten noch einmal neu.
      const [es0, ts, cs, all, st] = await Promise.all([
        db.getEntriesByMonth(s, year, month),
        db.getFixTemplates(s),
        db.getContracts(s),
        db.getAllEntries(s), // "Verfügbar jetzt" rechnet monatsübergreifend ab dem Startmonat
        db.getFinStartIdx(s, localTodayStr()),
      ]);
      const added = await db.applyMissingFixTemplatesWith(s, year, month, ts, es0);
      const es = added > 0 ? await db.getEntriesByMonth(s, year, month) : es0;
      setEntries(es);
      setAllEntries(all);
      setStartIdx(st);
      setTemplates(ts);
      setContracts(cs);
      hasData.current = true;
      snapshotSet(s?.user?.id, `fin:overview:${year}-${month}`, { entries: es, allEntries: all, startIdx: st, templates: ts, contracts: cs });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load, version]);

  // ── Kennzahlen ──────────────────────────────────────────────────────
  // Sparschwein-Einlagen ("Ersparnisse") nicht als normale Ausgabe werten
  // Sparschwein-Entnahmen ("Sparschwein"-Einnahme) sind keine echte
  // Einnahme — aus totalEin herausrechnen und mit Gespart verrechnen.
  const totalEntnommen = entries
    .filter((e) => isSparschweinDirectWithdrawal(e))
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  // Nur schon eingegangene Einnahmen: Posten mit Datum in der Zukunft zählen erst ab diesem Tag
  // (wie "+ Eingänge" in der Fokuskarte, lib/income.js).
  const arrived = dedupeIncome(entries).filter((e) => !isIncomePending(e, localTodayStr()));
  const totalEin = sumCat(arrived, 'fixeinnahmen') + sumCat(arrived, 'sonstige_einnahmen') - totalEntnommen;
  const spend    = SPEND_CATS.map((c) => ({
    ...c,
    value: entries
      .filter((e) => e.category === c.key && !isSparschweinDeposit(e))
      .reduce((s, e) => s + Number(e.amount || 0), 0),
  }));
  // Einnahmen mit Fälligkeitsdatum in der Zukunft zählen erst ab diesem Tag (lib/income.js, available).
  const today = localTodayStr();

  // Sparschwein-Einlagen sind KEINE offenen Posten — sofort verbucht,
  // müssen nie "bezahlt" werden. Ausschließen, sonst tauchen sie als
  // offene Posten auf (Übersicht + "Offene Posten"-Bereich).
  // Offen ist nur der noch nicht bezahlte Teil (Bar/Gutschein/Sparschwein gelten
  // sofort als bezahlt, auch bei geteilter Zahlung).
  const offene = entries.filter(isOpenExpense);
  const offeneSumme = offene.reduce((s, e) => s + openAmount(e), 0);

  // "Verfügbar jetzt": alle Eingänge bis heute minus alles Bezahlte, ohne Monatsgrenze (lib/income.js)
  const stand = available(allEntries, today, startIdx);

  const expiring =
    templates.filter((t) => getTemplateStatus(t) === 'expiring').length +
    contracts.filter((c) => getContractStatus(c) === 'expiring').length;
  const laufende =
    templates.filter((t) => getTemplateStatus(t) !== 'expired').length +
    contracts.filter((c) => getContractStatus(c) !== 'expired').length;

  return (
    <>
      {/* Fokuskarte: Verfügbar jetzt (dieselbe Karte wie in Buchungen, Offene Posten und Hub); antippen öffnet die Einnahmen */}
      <AvailableCard
        stand={standSummary(stand)}
        loading={loading}
        flow
        right="Einnahmen ›"
        onPress={() => onNavigate('einnahmen')}
        label="Verfügbar jetzt, Einnahmen öffnen"
      />

      {/* Offene Posten: nur sichtbar, wenn wirklich etwas offen ist */}
      {offene.length > 0 && (
        <button type="button" className="fin-open-strip" onClick={() => onNavigate('offen')}>
          <span className="fin-open-strip-badge" aria-hidden="true"><AreaIcon id="clock" size={20} /></span>
          <span className="fin-open-strip-text">
            <b>{offene.length === 1 ? '1 offener Posten' : `${offene.length} offene Posten`}</b>
            <small>noch zu bezahlen</small>
          </span>
          <span className="fin-open-strip-sum">{formatEur(offeneSumme)}</span>
          <span className="fin-open-strip-chev" aria-hidden="true"><Icon name="open" size={null} className="glyph" /></span>
        </button>
      )}

      {/* Schnellübersicht: Kreisdiagramm, Einnahmen in der Mitte, drei Ausgabebereiche im Ring */}
      <SpendDonut cats={spend} income={totalEin} monthLabel={MONTHS_DE[month - 1]} />

      {/* Bereiche als Liste, ohne Überschrift (Offene Posten steht als Streifen unter der Fokuskarte) */}
      <section className="page-section">
        <AreaList icons>
          <AreaRow
            label="Ausgaben"
            icon="list"
            value={`${entries.filter((e) => isListedEntry(e) && EXPENSE_CATS.has(e.category)).length} im Monat`}
            onPress={() => onNavigate('buchungen')}
          />
          <AreaRow
            label="Verträge"
            icon="contract"
            value={expiring > 0 ? `${expiring} läuft aus` : `${laufende}`}
            tone={expiring > 0 ? 'caution' : 'neutral'}
            onPress={() => onNavigate('vertraege')}
          />
          <AreaRow
            label="Auswertung"
            icon="chart"
            value="Jahr"
            onPress={() => onNavigate('auswertung')}
          />
          <AreaRow
            label="Einstellungen"
            icon="gear"
            onPress={() => onNavigate('einstellungen')}
          />
        </AreaList>
      </section>

      {/* Sparen ganz unten: Sparschwein und Sparpläne */}
      <SparschweinSection year={year} month={month} />
    </>
  );
}
