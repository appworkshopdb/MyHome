// modules/finance/components/OverviewSection.jsx
// Modul-Übersicht für Finanzen — passt ohne Scrollen auf einen Screen.
// Monatsnavigation entfernt — Übersicht zeigt immer den aktuellen Monat.
// Navigation durch vergangene Monate nur noch in Buchungen (MonthsView).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useEntrySheet } from '../../../core/lib/EntrySheetContext';
import * as db from '../lib/finData';
import {
  MONTHS_DE,
  formatEur,
  sumCat,
  getContractStatus,
  getTemplateStatus,
  isSparschweinDeposit,
} from '../lib/finance';
import FocusCard from '../../../core/components/FocusCard.jsx';
import PageSection from '../../../core/components/PageSection.jsx';
import AreaList from '../../../core/components/AreaList.jsx';
import AreaRow from '../../../core/components/AreaRow.jsx';

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

  const [entries,   setEntries]   = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // useRef-Muster: session-Objekt ändert sich nicht pro Render → load bleibt stabil
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = sessionRef.current;
      await db.applyMissingFixTemplates(s, year, month);
      const [es, ts, cs] = await Promise.all([
        db.getEntriesByMonth(s, year, month),
        db.getFixTemplates(s),
        db.getContracts(s),
      ]);
      setEntries(es);
      setTemplates(ts);
      setContracts(cs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load, version]);

  // ── Kennzahlen ──────────────────────────────────────────────────────
  // Sparschwein-Einlagen ("Ersparnisse") nicht als normale Ausgabe werten
  const totalEin = sumCat(entries, 'fixeinnahmen') + sumCat(entries, 'sonstige_einnahmen');
  const spend    = SPEND_CATS.map((c) => ({
    ...c,
    value: entries
      .filter((e) => e.category === c.key && !isSparschweinDeposit(e))
      .reduce((s, e) => s + Number(e.amount || 0), 0),
  }));
  const totalAus   = spend.reduce((s, c) => s + c.value, 0);
  const totalGespart = entries
    .filter((e) => isSparschweinDeposit(e))
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const saldo      = totalEin - totalAus - totalGespart;
  const spentRatio = totalEin > 0 ? Math.min(1, totalAus / totalEin) : 0;

  // Sparschwein-Einlagen sind KEINE offenen Posten — sofort verbucht,
  // müssen nie "bezahlt" werden. Ausschließen, sonst tauchen sie als
  // offene Posten auf (Übersicht + "Offene Posten"-Bereich).
  const offene = entries.filter(
    (e) => !e.paid && e.category !== 'fixeinnahmen' && e.category !== 'sonstige_einnahmen' && !isSparschweinDeposit(e)
  );
  const offeneSumme = offene.reduce((s, e) => s + Number(e.amount || 0), 0);

  const expiring =
    templates.filter((t) => getTemplateStatus(t) === 'expiring').length +
    contracts.filter((c) => getContractStatus(c) === 'expiring').length;
  const laufende =
    templates.filter((t) => getTemplateStatus(t) !== 'expired').length +
    contracts.filter((c) => getContractStatus(c) !== 'expired').length;

  const barTotal = Math.max(totalEin, totalAus) || 1;

  return (
    <>
      {/* Kopfzeile: Titel + Monat als Text (kein Wechsler mehr) */}
      <div className="fin-overview-head">
        <h1 className="overview-page-title">Finanzen</h1>
        <span className="t-meta" style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>
          {MONTHS_DE[month - 1]} {year}
        </span>
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

      {/* ── Bereiche */}
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
