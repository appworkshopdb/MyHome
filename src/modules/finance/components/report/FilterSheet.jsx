// Filter-Sheet der Auswertung. Arbeitet auf einer Kopie (Entwurf) und
// übernimmt sie erst bei "Anzeigen"; "Abbrechen" verwirft sie.
// Jede Gruppe nennt, auf welche Bereiche sie wirkt (siehe SECTIONS in
// sections.jsx) — die Abweichungen stehen zusätzlich in deren Kopfzeile.

import { useState } from 'react';
import SheetShell from '../../../../core/components/SheetShell.jsx';
import {
  ALL_CATS, TYPES, PAYMENTS, PAYMENT_LABEL, DEFAULT_FILTERS,
  applyFilters, inRange, HONOR,
} from '../../lib/analytics.js';
import { CATEGORIES } from '../../lib/finance.js';

const TYPE_LABEL = { einnahme: 'Einnahmen', ausgabe: 'Ausgaben', sparen: 'Sparen' };

function toggle(list, key, all) {
  const next = list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
  // Nie eine leere Auswahl zulassen — "nichts gewählt" wäre ein stiller Leer-Bildschirm
  return next.length === 0 ? list : all.filter((x) => next.includes(x));
}

function Group({ label, scope, children }) {
  return (
    <div className="rp-fgroup">
      <div className="rp-fgroup-h">
        <span>{label}</span>
        {scope && <em>{scope}</em>}
      </div>
      {children}
    </div>
  );
}

function MultiChips({ all, value, labels, onChange }) {
  return (
    <div className="rp-chiprow">
      {all.map((k) => (
        <button
          key={k} type="button"
          className={`rp-chip rp-chip--lg ${value.includes(k) ? 'is-on' : ''}`}
          aria-pressed={value.includes(k)}
          onClick={() => onChange(toggle(value, k, all))}
        >
          {value.includes(k) ? '✓ ' : ''}{labels[k] || k}
        </button>
      ))}
    </div>
  );
}

function Seg({ value, options, onChange, label }) {
  return (
    <div className="rp-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" className={value === o.key ? 'is-on' : ''} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function FilterSheet({ filters, entries, range, onApply, onClose }) {
  const [d, setD] = useState(filters);
  const set = (patch) => setD((cur) => ({ ...cur, ...patch }));

  const count = applyFilters(inRange(entries, range), d, HONOR.all).length;
  const numOrNull = (v) => (v === '' || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v)));

  return (
    <SheetShell onClose={onClose} labelledBy="rp-filter-title">
      <div className="sheet-header">
        <div className="sheet-title t-title" id="rp-filter-title">Filter</div>
        <button type="button" className="sheet-cancel" onClick={() => setD({ ...DEFAULT_FILTERS })}>Zurücksetzen</button>
      </div>

      <div className="wiz-body rp-fbody">
        <Group label="Vergleichen mit" scope="Kennzahlen · Posten">
          <Seg
            label="Vergleich" value={d.compare} onChange={(compare) => set({ compare })}
            options={[{ key: 'none', label: 'Aus' }, { key: 'prev', label: 'Vorperiode' }, { key: 'year', label: 'Vorjahr' }]}
          />
        </Group>

        <Group label="Art" scope="alle Bereiche außer Verlauf, Auffälligkeiten, Verträge, Fristen">
          <MultiChips all={TYPES} value={d.types} labels={TYPE_LABEL} onChange={(types) => set({ types })} />
        </Group>

        <Group label="Kategorie" scope="wie Art">
          <MultiChips all={ALL_CATS} value={d.categories} labels={CATEGORIES} onChange={(categories) => set({ categories })} />
        </Group>

        <Group label="Zahlungsart" scope="alle Bereiche außer „Womit wurde bezahlt?“">
          <MultiChips all={PAYMENTS} value={d.payments} labels={PAYMENT_LABEL} onChange={(payments) => set({ payments })} />
          <p className="rp-fhint">Buchungen mit geteilter Zahlung erscheinen, sobald eine ihrer Zahlungsarten gewählt ist.</p>
        </Group>

        <Group label="Status" scope="nur Ausgaben">
          <Seg
            label="Status" value={d.status} onChange={(status) => set({ status })}
            options={[{ key: 'alle', label: 'Alle' }, { key: 'bezahlt', label: 'Bezahlt' }, { key: 'offen', label: 'Offen' }]}
          />
          <p className="rp-fhint">Einnahmen haben kein Bezahlt-Häkchen und bleiben von diesem Filter unberührt.</p>
        </Group>

        <Group label="Herkunft">
          <Seg
            label="Herkunft" value={d.origin} onChange={(origin) => set({ origin })}
            options={[{ key: 'alle', label: 'Alle' }, { key: 'vorlage', label: 'Feste Posten' }, { key: 'manuell', label: 'Einzelbuchungen' }]}
          />
          <p className="rp-fhint">Feste Posten entstehen automatisch aus Vorlagen, Einzelbuchungen erfasst du selbst.</p>
        </Group>

        <Group label="Betrag pro Buchung">
          <div className="rp-frange">
            <label>
              <span>von (€)</span>
              <input className="wiz-input" type="number" inputMode="decimal" min="0" value={d.amountMin ?? ''} onChange={(e) => set({ amountMin: numOrNull(e.target.value) })} placeholder="0" />
            </label>
            <label>
              <span>bis (€)</span>
              <input className="wiz-input" type="number" inputMode="decimal" min="0" value={d.amountMax ?? ''} onChange={(e) => set({ amountMax: numOrNull(e.target.value) })} placeholder="beliebig" />
            </label>
          </div>
        </Group>

        <Group label="Name enthält">
          <input
            className="wiz-input" type="text" value={d.name} maxLength={80}
            onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Miete, Tanken, Netflix …"
          />
        </Group>

        <Group label="Sparschwein-Buchungen">
          <Seg
            label="Sparschwein" value={d.savingsMode} onChange={(savingsMode) => set({ savingsMode })}
            options={[{ key: 'separat', label: 'Als Sparen' }, { key: 'ausgabe', label: 'Wie gebucht' }, { key: 'aus', label: 'Ausblenden' }]}
          />
          <p className="rp-fhint">„Ersparnisse“ und „Sparschwein“-Buchungen sind keine echten Ausgaben bzw. Einnahmen. Standard: separat als „Sparen“ ausweisen — wie in Übersicht und Buchungen.</p>
        </Group>
      </div>

      <div className="entry-modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}>Abbrechen</button>
        <button type="button" className="btn btn-primary" onClick={() => onApply(d)}>
          {count} {count === 1 ? 'Buchung' : 'Buchungen'} anzeigen
        </button>
      </div>
    </SheetShell>
  );
}
