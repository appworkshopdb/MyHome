// modules/finance/components/OverviewSection.jsx
// Modul-Übersicht für Finanzen — passt ohne Scrollen auf einen Screen
// (siehe UMBAU-PLAN.md Schritt 6): Kopfzeile mit Monatswechsler,
// Saldo-Fokuskarte, "Wohin es geht" und die Bereiche-Liste.
//
// Datenzugriff: dieselben Abfragen, die vorher MonthsView/ContractsView
// auf der Modulseite ausgelöst haben — kein zusätzlicher Netzwerk-Zugriff
// gegenüber dem alten Stapel aus vier PageSections, nur früher gebündelt.
// Die Detail-Screens laden ihre Daten weiterhin selbst (sie sind
// unverändert), das ist gewollt: sie sollen ohne diese Übersicht
// funktionieren.
//
// Der Monatswechsler hier steuert NUR die Übersicht. MonthsView bringt
// seinen eigenen Monat mit (unverändert) und startet wie bisher im
// aktuellen Monat.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import * as db from '../lib/finData';
import {
  MONTHS_DE,
  formatEur,
  sumCat,
  getContractStatus,
  getTemplateStatus,
} from '../lib/finance';
import FocusCard from '../../../core/components/FocusCard.jsx';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';
import { IconChevronLeft, IconChevronRight } from '../../../core/components/Icons';

// Die drei Ausgabenblöcke des Monats — Reihenfolge und Farbe entsprechen
// dem gestapelten Balken im Mockup (--data-1 … --data-3).
const SPEND_CATS = [
  { key: 'fixkosten',         label: 'Fixkosten',        tone: 'a' },
  { key: 'variable_kosten',   label: 'Variable Kosten',  tone: 'b' },
  { key: 'sonstige_ausgaben', label: 'Sonstiges',        tone: 'c' },
];

export default function OverviewSection({ onNavigate }) {
  const { session } = useAuth();
  // Nach dem Speichern im globalen Erfassen-Sheet neu laden — gleiches
  // Muster wie in MonthsView.
  const { version } = useEntrySheet();

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [entries,   setEntries]   = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await db.applyMissingFixTemplates(session, year, month);
      const [es, ts, cs] = await Promise.all([
        db.getEntriesByMonth(session, year, month),
        db.getFixTemplates(session),
        db.getContracts(session),
      ]);
      setEntries(es);
      setTemplates(ts);
      setContracts(cs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [session, year, month]);

  useEffect(() => { load(); }, [load, version]);

  function shiftMonth(delta) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  }

  // ── Kennzahlen ────────────────────────────────────────────────────
  const totalEin = sumCat(entries, 'fixeinnahmen') + sumCat(entries, 'sonstige_einnahmen');
  const spend    = SPEND_CATS.map((c) => ({ ...c, value: sumCat(entries, c.key) }));
  const totalAus = spend.reduce((s, c) => s + c.value, 0);
  const saldo    = totalEin - totalAus;
  const spentRatio = totalEin > 0 ? Math.min(1, totalAus / totalEin) : 0;

  const offene = entries.filter(
    (e) => !e.paid && e.category !== 'fixeinnahmen' && e.category !== 'sonstige_einnahmen'
  );
  const offeneSumme = offene.reduce((s, e) => s + Number(e.amount || 0), 0);

  // "Verträge" bündelt Vorlagen UND Verträge — genau das zeigt auch
  // ContractsView auf dem Detail-Screen.
  const expiring =
    templates.filter((t) => getTemplateStatus(t) === 'expiring').length +
    contracts.filter((c) => getContractStatus(c) === 'expiring').length;
  const laufende =
    templates.filter((t) => getTemplateStatus(t) !== 'expired').length +
    contracts.filter((c) => getContractStatus(c) !== 'expired').length;

  return (
    <>
      <div className="fin-overview-head">
        <h1 className="overview-page-title">Finanzen</h1>
        <div className="fin-month-pill">
          <button onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat">
            <IconChevronLeft />
          </button>
          <span>{MONTHS_DE[month - 1]}</span>
          <button onClick={() => shiftMonth(1)} aria-label="Nächster Monat">
            <IconChevronRight />
          </button>
        </div>
      </div>

      {/* Fokuskarte: Saldo des gewählten Monats */}
      <FocusCard>
        <FocusCard.Eyebrow>Saldo</FocusCard.Eyebrow>
        <FocusCard.Value>{loading ? '—' : formatEur(saldo)}</FocusCard.Value>
        <FocusCard.Meta>
          <span>Ein <b>{formatEur(totalEin)}</b></span>
          <span>Aus <b>{formatEur(totalAus)}</b></span>
        </FocusCard.Meta>
        <FocusCard.Progress value={spentRatio} />
      </FocusCard>

      {/* Wohin es geht — gestapelter Balken + Legende */}
      <PageSection
        title="Wohin es geht"
        action={{ label: 'Details ›', onPress: () => onNavigate('auswertung') }}
      >
        <div className="fin-split-card">
          {totalAus > 0 ? (
            <>
              <div className="fin-split-bar">
                {spend.map((c) => (
                  c.value > 0 && (
                    <div
                      key={c.key}
                      className={`fin-split-seg fin-split-seg--${c.tone}`}
                      style={{ width: `${(c.value / totalAus) * 100}%` }}
                    />
                  )
                ))}
              </div>
              <div className="fin-split-legend">
                {spend.map((c) => (
                  <span key={c.key} className="fin-split-legend-item">
                    <i className={`fin-split-dot fin-split-dot--${c.tone}`} />
                    {c.label} <b>{formatEur(c.value)}</b>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="fin-split-empty">
              {loading ? 'Lädt …' : 'In diesem Monat noch keine Ausgaben erfasst.'}
            </div>
          )}
        </div>
      </PageSection>

      {/* Bereiche */}
      <PageSection title="Bereiche">
        <AreaList fabClearance>
          <AreaRow
            label="Buchungen"
            value={`${entries.length} im Monat`}
            onPress={() => onNavigate('buchungen')}
          />
          <AreaRow
            label="Offene Posten"
            value={offene.length > 0 ? `${offene.length} · ${formatEur(offeneSumme)}` : 'alles bezahlt'}
            tone={offene.length > 0 ? 'critical' : 'neutral'}
            onPress={() => onNavigate('offen')}
          />
          <AreaRow
            label="Verträge"
            value={expiring > 0 ? `${expiring} läuft aus` : `${laufende}`}
            tone={expiring > 0 ? 'caution' : 'neutral'}
            onPress={() => onNavigate('vertraege')}
          />
          <AreaRow
            label="Auswertung"
            value="Jahr"
            onPress={() => onNavigate('auswertung')}
          />
          <AreaRow
            label="Einstellungen"
            onPress={() => onNavigate('einstellungen')}
          />
        </AreaList>
      </PageSection>
    </>
  );
}
