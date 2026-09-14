// modules/finance/components/OverviewSection.jsx

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

// Alle 4 Kategorien für die Schnellübersicht — Einnahmen zuerst, dann
// die drei Ausgabenblöcke. Tone d = data-4 (weiß/hell, für Einnahmen
// auf der Balken-Karte wird Einnahmen separat behandelt).
const SPEND_CATS = [
  { key: 'fixkosten',         label: 'Fixkosten',       tone: 'a' },
  { key: 'variable_kosten',   label: 'Variable Kosten', tone: 'b' },
  { key: 'sonstige_ausgaben', label: 'Sonstiges',       tone: 'c' },
];

export default function OverviewSection({ onNavigate }) {
  const { session } = useAuth();
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

  // ── Kennzahlen ──────────────────────────────────────────────────────
  const totalEin   = sumCat(entries, 'fixeinnahmen') + sumCat(entries, 'sonstige_einnahmen');
  const spend      = SPEND_CATS.map((c) => ({ ...c, value: sumCat(entries, c.key) }));
  const totalAus   = spend.reduce((s, c) => s + c.value, 0);
  const saldo      = totalEin - totalAus;
  const spentRatio = totalEin > 0 ? Math.min(1, totalAus / totalEin) : 0;

  const offene = entries.filter(
    (e) => !e.paid && e.category !== 'fixeinnahmen' && e.category !== 'sonstige_einnahmen'
  );
  const offeneSumme = offene.reduce((s, e) => s + Number(e.amount || 0), 0);

  const expiring =
    templates.filter((t) => getTemplateStatus(t) === 'expiring').length +
    contracts.filter((c) => getContractStatus(c) === 'expiring').length;
  const laufende =
    templates.filter((t) => getTemplateStatus(t) !== 'expired').length +
    contracts.filter((c) => getContractStatus(c) !== 'expired').length;

  // Gesamtbetrag für den Balken (Ein + Aus, damit Einnahmen-Segment
  // proportional zur Ausgabenseite dargestellt wird)
  const barTotal = Math.max(totalEin, totalAus) || 1;

  return (
    <>
      {/* Kopfzeile: Titel + Monatswechsler */}
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

      {/* Fokuskarte: Saldo */}
      <FocusCard>
        <FocusCard.Eyebrow>Saldo</FocusCard.Eyebrow>
        <FocusCard.Value>{loading ? '—' : formatEur(saldo)}</FocusCard.Value>
        <FocusCard.Meta>
          {/* "+" statt "Ein", "−" statt "Aus" */}
          <span>+ <b>{formatEur(totalEin)}</b></span>
          <span>− <b>{formatEur(totalAus)}</b></span>
        </FocusCard.Meta>
        <FocusCard.Progress value={spentRatio} />
      </FocusCard>

      {/* ── Schnellübersicht ──────────────────────────────────────────
          Gesamter Block antippbar → navigiert zu Buchungen.
          Einnahmen als 4. Kategorie (Ton "d") neben den drei Ausgabenblöcken.
          Der gestapelte Balken zeigt alle 4 Segmente.
      ─────────────────────────────────────────────────────────────── */}
      <PageSection title="Schnellübersicht">
        <button
          className="fin-split-card fin-split-card--tappable"
          onClick={() => onNavigate('buchungen')}
          aria-label="Alle Buchungen ansehen"
        >
          {/* Balken: Ausgaben-Segmente + Einnahmen-Segment */}
          {(totalAus > 0 || totalEin > 0) ? (
            <>
              <div className="fin-split-bar">
                {spend.map((c) =>
                  c.value > 0 && (
                    <div
                      key={c.key}
                      className={`fin-split-seg fin-split-seg--${c.tone}`}
                      style={{ width: `${(c.value / barTotal) * 100}%` }}
                    />
                  )
                )}
                {totalEin > 0 && (
                  <div
                    className="fin-split-seg fin-split-seg--d"
                    style={{ width: `${(totalEin / barTotal) * 100}%` }}
                  />
                )}
              </div>

              {/* Legende: Fixkosten, Variable, Sonstiges, Einnahmen */}
              <div className="fin-split-legend">
                {spend.map((c) => (
                  <span key={c.key} className="fin-split-legend-item">
                    <i className={`fin-split-dot fin-split-dot--${c.tone}`} />
                    {c.label} <b>{formatEur(c.value)}</b>
                  </span>
                ))}
                <span className="fin-split-legend-item">
                  <i className="fin-split-dot fin-split-dot--d" />
                  Einnahmen <b>{formatEur(totalEin)}</b>
                </span>
              </div>
            </>
          ) : (
            <div className="fin-split-empty">
              {loading ? 'Lädt …' : 'In diesem Monat noch keine Einträge erfasst.'}
            </div>
          )}


        </button>
      </PageSection>

      {/* ── Bereiche (ohne "Buchungen" — der ist jetzt in Schnellübersicht) */}
      <PageSection title="Bereiche">
        <AreaList fabClearance>
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
