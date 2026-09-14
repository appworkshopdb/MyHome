import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import * as db from '../lib/finData';
import {
  formatEur,
  formatDate,
  getContractStatus,
  getContractEndDate,
  getTemplateStatus,
  getTemplateEndDate,
  intervalLabel,
  monthlyAmount,
  INTERVALS,
  MONTHS_DE,
} from '../lib/finance';
import ContractModal from './ContractModal';
import FixTemplateModal from './FixTemplateModal';
import PaymentBadge from './PaymentBadge';
import { IconEdit, IconTrash } from '../../../core/components/Icons';

// Status-Tokens auf das neue Drei-Ebenen-System gemappt
const STATUS_MAP = {
  active:   { label: 'Aktiv',      bg: 'var(--status-positive-bg)', fg: 'var(--status-positive)' },
  expiring: { label: 'Läuft aus',  bg: 'var(--status-caution-bg)',  fg: 'var(--status-caution)'  },
  expired:  { label: 'Abgelaufen', bg: 'var(--status-critical-bg)', fg: 'var(--status-critical)' },
};

function IntervalHint({ item }) {
  const iv = item.interval ?? (item.quarterly ? 'quarterly' : 'monthly');
  if (iv === 'monthly') return null;
  const ivMonths = INTERVALS[iv]?.months ?? 1;
  return (
    <span className="t-meta" style={{ color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
      alle {ivMonths} Monate ab {MONTHS_DE[(item.start_month || 1) - 1]}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.active;
  return (
    <span
      className="t-chip"
      style={{
        background: s.bg,
        color: s.fg,
        padding: '2px 7px',
        borderRadius: 'var(--r-pill)',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {s.label}
    </span>
  );
}

// ── Einnahmequellen ──────────────────────────────────────────────────────────
function EinnahmequellenSection({ templates, onEdit, onAdd, onApply }) {
  const items   = templates.filter((t) => t.category === 'fixeinnahmen');
  const active  = items.filter((t) => getTemplateStatus(t) !== 'expired');
  const expired = items.filter((t) => getTemplateStatus(t) === 'expired');

  const totalMonthly = active.reduce((s, t) => {
    const iv = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
    return s + monthlyAmount(t.amount, iv);
  }, 0);

  function renderRow(t) {
    const iv      = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
    const monthly = monthlyAmount(t.amount, iv);
    const st      = getTemplateStatus(t);
    const endDate = getTemplateEndDate(t);

    return (
      <tr
        key={t.id}
        className="entry-row"
        style={{ cursor: 'pointer', opacity: st === 'expired' ? 0.5 : 1 }}
        onClick={() => onEdit(t)}
      >
        <td>
          <div className="t-body" style={{ fontWeight: 500 }}>{t.name}</div>
          <IntervalHint item={t} />
        </td>
        <td className="t-meta" style={{ color: 'var(--text-secondary)' }}>
          {t.start_date ? formatDate(t.start_date) : '—'}
        </td>
        <td className="t-meta" style={{ color: 'var(--text-secondary)' }}>
          {t.is_open
            ? <span style={{ color: 'var(--text-muted)' }}>unbefristet</span>
            : endDate ? formatDate(endDate) : '—'}
        </td>
        <td>
          {(t.start_date || t.end_date || t.contract_duration_months || t.is_open) && (
            <StatusBadge status={st} />
          )}
        </td>
        <td><PaymentBadge payment={t.payment} /></td>
        <td style={{ textAlign: 'right' }}>
          <div className="t-body" style={{ fontWeight: 700 }}>{formatEur(t.amount)}</div>
          {iv !== 'monthly' && (
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
              ≈ {formatEur(monthly)}/Mo.
            </div>
          )}
        </td>
        <td className="actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn-icon" title="Bearbeiten" onClick={() => onEdit(t)}>
            <IconEdit />
          </button>
        </td>
      </tr>
    );
  }

  function renderTable(rows) {
    if (rows.length === 0) return null;
    return (
      <div className="table-wrap">
        <table className="entry-table">
          <thead>
            <tr>
              <th>Name</th><th>Beginn</th><th>Ende</th>
              <th>Status</th><th>Zahlung</th>
              <th style={{ textAlign: 'right' }}>Betrag</th><th />
            </tr>
          </thead>
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">Einnahmequellen</div>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>
        Feste Einnahmen — werden automatisch in jeden neuen Monat übernommen.
      </p>

      {items.length === 0 ? (
        <p className="t-body" style={{ color: 'var(--text-muted)', padding: '6px 0 10px' }}>
          Noch keine Einnahmequellen angelegt.
        </p>
      ) : (
        <>
          {renderTable(active)}
          {active.length > 0 && (
            <div className="contracts-total-row">
              <span className="t-meta">Gesamt/Monat (aktiv)</span>
              <span className="t-body" style={{ color: 'var(--status-positive)', fontWeight: 700 }}>
                {formatEur(totalMonthly)}
              </span>
            </div>
          )}
          {expired.length > 0 && (
            <>
              <p className="t-meta" style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: 16, marginBottom: 6 }}>
                Abgelaufen ({expired.length})
              </p>
              {renderTable(expired)}
            </>
          )}
        </>
      )}

      <div className="contracts-btn-row">
        <button className="btn btn-primary"   onClick={onAdd}>+ Hinzufügen</button>
        <button className="btn btn-secondary" onClick={onApply}>Auf aktuellen Monat anwenden</button>
      </div>
    </div>
  );
}

// ── Fixkosten & Verträge ─────────────────────────────────────────────────────
function FixkostenSection({ templates, contracts, onEditTemplate, onAddTemplate, onApply, onEditContract, onAddContract, onDeleteContract }) {
  const fixItems = templates.filter((t) => t.category === 'fixkosten');

  const allItems = [
    ...fixItems.map((t)  => ({ _src: 'template', ...t })),
    ...contracts.map((c) => ({ _src: 'contract', ...c })),
  ];

  const active  = allItems.filter((x) =>
    x._src === 'template' ? getTemplateStatus(x) !== 'expired' : getContractStatus(x) !== 'expired'
  );
  const expired = allItems.filter((x) =>
    x._src === 'template' ? getTemplateStatus(x) === 'expired' : getContractStatus(x) === 'expired'
  );

  const totalMonthly = active.reduce((s, x) => {
    const iv = x.interval ?? (x.quarterly ? 'quarterly' : 'monthly');
    return s + monthlyAmount(x.amount, iv);
  }, 0);

  const expiringSoon = active.filter((x) =>
    x._src === 'template' ? getTemplateStatus(x) === 'expiring' : getContractStatus(x) === 'expiring'
  ).length;

  function renderRow(x) {
    const isContract = x._src === 'contract';
    const iv       = x.interval ?? (x.quarterly ? 'quarterly' : 'monthly');
    const monthly  = monthlyAmount(x.amount, iv);
    const st       = isContract ? getContractStatus(x) : getTemplateStatus(x);
    const endDate  = isContract ? getContractEndDate(x) : getTemplateEndDate(x);
    const isOpen   = x.is_open || x.is_monthly;

    return (
      <tr key={`${x._src}-${x.id}`} style={{ opacity: st === 'expired' ? 0.5 : 1 }}>
        <td>
          <div className="t-body" style={{ fontWeight: 500 }}>{x.name}</div>
          {x.notes && (
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>{x.notes}</div>
          )}
          {!isContract && <IntervalHint item={x} />}
          {isContract && iv !== 'monthly' && (
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>{intervalLabel(iv)}</div>
          )}
        </td>
        <td className="t-meta" style={{ color: 'var(--text-secondary)' }}>
          {x.start_date ? formatDate(x.start_date) : '—'}
        </td>
        <td className="t-meta" style={{ color: 'var(--text-secondary)' }}>
          {isOpen
            ? <span style={{ color: 'var(--text-muted)' }}>unbefristet</span>
            : endDate ? formatDate(endDate) : '—'}
        </td>
        <td><PaymentBadge payment={x.payment} /></td>
        <td style={{ textAlign: 'right' }}>
          <div className="t-body" style={{ fontWeight: 700 }}>{formatEur(x.amount)}</div>
          {iv !== 'monthly' && (
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>
              ≈ {formatEur(monthly)}/Mo.
            </div>
          )}
        </td>
        <td><StatusBadge status={st} /></td>
        <td className="actions">
          <button
            className="btn-icon"
            title="Bearbeiten"
            onClick={() => isContract ? onEditContract(x) : onEditTemplate(x)}
          >
            <IconEdit />
          </button>
          {isContract && (
            <button
              className="btn-icon"
              title="Löschen"
              style={{ color: 'var(--status-critical)' }}
              onClick={() => onDeleteContract(x.id)}
            >
              <IconTrash />
            </button>
          )}
        </td>
      </tr>
    );
  }

  function renderTable(rows) {
    if (rows.length === 0) return null;
    return (
      <div className="table-wrap">
        <table className="entry-table">
          <thead>
            <tr>
              <th>Name</th><th>Beginn</th><th>Ende</th>
              <th>Zahlung</th><th style={{ textAlign: 'right' }}>Betrag</th>
              <th>Status</th><th />
            </tr>
          </thead>
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">Fixkosten &amp; Verträge</div>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>
        Feste Ausgaben und Verträge — mit Laufzeit, Ablauf-Status und monatlicher Kostenrechnung.
      </p>

      {allItems.length > 0 && (
        <div className="summary-row" style={{ marginBottom: 14 }}>
          <div className="summary-chip negative">
            <div className="label">Kosten/Monat</div>
            <div className="value">{formatEur(totalMonthly)}</div>
          </div>
          <div className="summary-chip">
            <div className="label">Aktiv</div>
            <div className="value">{active.length}</div>
          </div>
          {expiringSoon > 0 && (
            <div className="summary-chip negative">
              <div className="label">Läuft bald aus</div>
              <div className="value">{expiringSoon}</div>
            </div>
          )}
          <div className="summary-chip neutral">
            <div className="label">Kosten/Jahr</div>
            <div className="value">{formatEur(totalMonthly * 12)}</div>
          </div>
        </div>
      )}

      {allItems.length === 0 ? (
        <p className="t-body" style={{ color: 'var(--text-muted)', padding: '6px 0 10px' }}>
          Noch keine Einträge angelegt.
        </p>
      ) : (
        <>
          {renderTable(active)}
          {active.length > 0 && (
            <div className="contracts-total-row">
              <span className="t-meta">Gesamt monatlich (aktiv)</span>
              <span className="t-body" style={{ color: 'var(--status-critical)', fontWeight: 700 }}>
                {formatEur(totalMonthly)}
              </span>
            </div>
          )}
          {expired.length > 0 && (
            <>
              <p className="t-meta" style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: 16, marginBottom: 6 }}>
                Abgelaufen ({expired.length})
              </p>
              {renderTable(expired)}
            </>
          )}
        </>
      )}

      <div className="contracts-btn-row">
        <button className="btn btn-primary"   onClick={onAddTemplate}>+ Fixkosten</button>
        <button className="btn btn-secondary" onClick={onAddContract}>+ Vertrag</button>
        <button className="btn btn-secondary" onClick={onApply}>Auf aktuellen Monat anwenden</button>
      </div>
    </div>
  );
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────
export default function ContractsView() {
  const { session }   = useAuth();
  const { showToast } = useUi();

  const [templates, setTemplates] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [modal,     setModal]     = useState(null);

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

  async function handleSaveTemplate(tpl) {
    const isNew = !tpl.id;
    // eslint-disable-next-line no-unused-vars
    const { _src, ...cleanTpl } = tpl;
    const saved = await db.saveFixTemplate(session, cleanTpl);
    if (isNew) await db.applyNewTemplateEverywhere(session, saved, now.getFullYear(), now.getMonth() + 1);
    setModal(null);
    showToast(isNew ? 'Posten in alle Monate übernommen' : 'Posten aktualisiert');
    load();
  }

  async function handleDeleteTemplate(id) {
    if (!confirm('Posten löschen? Bereits übernommene Monatswerte bleiben erhalten.')) return;
    await db.deleteFixTemplate(session, id);
    setModal(null);
    showToast('Posten gelöscht');
    load();
  }

  async function applyToCurrentMonth() {
    const added = await db.applyMissingFixTemplates(session, now.getFullYear(), now.getMonth() + 1);
    showToast(added > 0 ? `${added} Posten übernommen` : 'Monat bereits aktuell');
  }

  async function handleSaveContract(c) {
    await db.saveContract(session, c);
    setModal(null);
    showToast(c.id ? 'Vertrag aktualisiert' : 'Vertrag hinzugefügt');
    load();
  }

  async function handleDeleteContract(id) {
    if (!confirm('Vertrag löschen?')) return;
    await db.deleteContract(id);
    showToast('Vertrag gelöscht');
    load();
  }

  return (
    <>
      <EinnahmequellenSection
        templates={templates}
        onEdit={(t)  => setModal({ type: 'template', tpl: t, category: 'fixeinnahmen' })}
        onAdd={() => setModal({ type: 'template', tpl: null, category: 'fixeinnahmen' })}
        onApply={applyToCurrentMonth}
      />

      <FixkostenSection
        templates={templates}
        contracts={contracts}
        onEditTemplate={(t) => setModal({ type: 'template', tpl: t, category: 'fixkosten' })}
        onAddTemplate={() => setModal({ type: 'template', tpl: null, category: 'fixkosten' })}
        onApply={applyToCurrentMonth}
        onEditContract={(c) => setModal({ type: 'contract', contract: c })}
        onAddContract={() => setModal({ type: 'contract', contract: null })}
        onDeleteContract={handleDeleteContract}
      />

      {modal?.type === 'template' && (
        <FixTemplateModal
          tpl={modal.tpl}
          initialCategory={modal.category}
          currentMonth={now.getMonth() + 1}
          currentYear={now.getFullYear()}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
          onClose={() => setModal(null)}
          showToast={showToast}
        />
      )}

      {modal?.type === 'contract' && (
        <ContractModal
          contract={modal.contract}
          onSave={handleSaveContract}
          onClose={() => setModal(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
