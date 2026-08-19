import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import * as db from '../lib/finData';
import {
  formatEur,
  formatDate,
  getContractStatus,
  getContractEndDate,
  intervalLabel,
  monthlyAmount,
  INTERVALS,
  MONTHS_DE,
} from '../lib/finance';
import ContractModal from './ContractModal';
import FixTemplateModal from './FixTemplateModal';
import PaymentBadge from './PaymentBadge';
import { IconEdit, IconTrash } from '../../../core/components/Icons';

const CONTRACT_STATUS = {
  active:   { label: 'Aktiv',      bg: 'var(--success-light)', fg: 'var(--success)' },
  expiring: { label: 'Läuft aus',  bg: 'var(--warning-light)', fg: 'var(--warning)' },
  expired:  { label: 'Abgelaufen', bg: 'var(--danger-light)',  fg: 'var(--danger)'  },
};

// -----------------------------------------------------------------------
// Hilfsfunktion: Unterzeile für nicht-monatliche Intervalle
// -----------------------------------------------------------------------
function IntervalHint({ tpl }) {
  const iv = tpl.interval ?? (tpl.quarterly ? 'quarterly' : 'monthly');
  if (iv === 'monthly') return null;
  const ivMonths = INTERVALS[iv]?.months ?? 1;
  return (
    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>
      alle {ivMonths} Monate ab {MONTHS_DE[(tpl.start_month || 1) - 1]}
    </span>
  );
}

// -----------------------------------------------------------------------
// Sektion: Einnahmequellen & Fixe Ausgaben (FixTemplates)
// -----------------------------------------------------------------------
function TemplateSection({ title, description, category, templates, onEdit, onAdd, onApply }) {
  const filtered = templates.filter((t) => t.category === category);

  // Monatliche Summe (anteilig bei nicht-monatlichen Intervallen)
  const totalMonthly = filtered.reduce((s, t) => {
    const iv = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
    return s + monthlyAmount(t.amount, iv);
  }, 0);

  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <p style={{ marginBottom: 14, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        {description}
      </p>

      {filtered.length === 0 ? (
        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', padding: '6px 0 10px' }}>
          Noch keine Einträge angelegt.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="entry-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Zahlung</th>
                <th style={{ textAlign: 'right' }}>Betrag</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const iv = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
                const monthly = monthlyAmount(t.amount, iv);
                return (
                  <tr key={t.id} className="entry-row" style={{ cursor: 'pointer' }} onClick={() => onEdit(t)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      <IntervalHint tpl={t} />
                    </td>
                    <td><PaymentBadge payment={t.payment} /></td>
                    <td className="amount">
                      <div>{formatEur(t.amount)}</div>
                      {iv !== 'monthly' && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
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
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Gesamt/Monat
                  </td>
                  <td className="amount" style={{ color: category === 'fixeinnahmen' ? 'var(--success)' : 'var(--danger)' }}>
                    {formatEur(totalMonthly)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button className="btn btn-primary" onClick={onAdd}>+ Hinzufügen</button>
        <button className="btn btn-secondary" onClick={onApply}>Auf aktuellen Monat anwenden</button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Sektion: Verträge (fin_contracts)
// -----------------------------------------------------------------------
function ContractsSection({ contracts, onEdit, onAdd, onDelete }) {
  const active = contracts.filter((c) => getContractStatus(c) !== 'expired');
  const expired = contracts.filter((c) => getContractStatus(c) === 'expired');

  const totalMonthly = active.reduce((s, c) => {
    const iv = c.interval ?? (c.quarterly ? 'quarterly' : 'monthly');
    return s + monthlyAmount(c.amount, iv);
  }, 0);
  const expiringSoon = active.filter((c) => getContractStatus(c) === 'expiring').length;

  function renderRow(c) {
    const st = getContractStatus(c);
    const iv = c.interval ?? (c.quarterly ? 'quarterly' : 'monthly');
    const endDate = getContractEndDate(c);
    const monthly = monthlyAmount(c.amount, iv);

    return (
      <tr key={c.id} style={{ opacity: st === 'expired' ? 0.5 : 1 }}>
        <td>
          <div style={{ fontWeight: 500 }}>{c.name}</div>
          {c.notes && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.notes}</div>
          )}
          {iv !== 'monthly' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {intervalLabel(iv)}
            </div>
          )}
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 600 }}>{formatEur(c.amount)}</div>
          {iv !== 'monthly' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ≈ {formatEur(monthly)}/Mo.
            </div>
          )}
        </td>
        <td style={{ fontSize: '0.85rem' }}>
          {c.start_date ? formatDate(c.start_date) : '—'}
        </td>
        <td style={{ fontSize: '0.85rem' }}>
          {c.is_open || c.is_monthly
            ? <span style={{ color: 'var(--text-muted)' }}>unbefristet</span>
            : endDate ? formatDate(endDate) : '—'}
        </td>
        <td><PaymentBadge payment={c.payment} /></td>
        <td>
          <span
            className="badge"
            style={{ background: CONTRACT_STATUS[st].bg, color: CONTRACT_STATUS[st].fg, whiteSpace: 'nowrap' }}
          >
            {CONTRACT_STATUS[st].label}
          </span>
        </td>
        <td className="actions">
          <button className="btn-icon" title="Bearbeiten" onClick={() => onEdit(c)}><IconEdit /></button>
          <button className="btn-icon" title="Löschen" style={{ color: 'var(--danger)' }} onClick={() => onDelete(c.id)}><IconTrash /></button>
        </td>
      </tr>
    );
  }

  function renderTable(rows) {
    if (rows.length === 0) return null;
    return (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="entry-table">
          <thead>
            <tr>
              <th>Name</th><th>Betrag</th><th>Beginn</th><th>Ende</th>
              <th>Zahlung</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-title">Verträge</div>
      <p style={{ marginBottom: 14, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Laufende Verträge mit Start, Ende und automatisch berechnetem Ablauf-Status.
      </p>

      {/* Kennzahlen */}
      {contracts.length > 0 && (
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
        </div>
      )}

      {active.length === 0 && expired.length === 0 ? (
        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', padding: '6px 0 10px' }}>
          Noch keine Verträge eingetragen.
        </div>
      ) : (
        <>
          {renderTable(active)}
          {active.length > 0 && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: '1px solid var(--border)',
              fontSize: '0.85rem', color: 'var(--text-secondary)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Gesamt monatlich (aktiv)</span>
              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{formatEur(totalMonthly)}</span>
            </div>
          )}

          {expired.length > 0 && (
            <>
              <div style={{ marginTop: 16, marginBottom: 6, fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Abgelaufen ({expired.length})
              </div>
              {renderTable(expired)}
            </>
          )}
        </>
      )}

      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={onAdd}>+ Vertrag hinzufügen</button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Hauptkomponente
// -----------------------------------------------------------------------
export default function ContractsView() {
  const { session } = useAuth();
  const { showToast } = useUi();

  const [templates, setTemplates] = useState([]);
  const [contracts, setContracts] = useState([]);

  // modal: { type: 'contract', contract } | { type: 'template', tpl, category }
  const [modal, setModal] = useState(null);

  const now = new Date();

  const load = useCallback(async () => {
    const [tpls, ctrts] = await Promise.all([
      db.getFixTemplates(session),
      db.getContracts(session),
    ]);
    tpls.sort((a, b) => a.name.localeCompare(b.name));
    setTemplates(tpls);
    setContracts(ctrts);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  // --- FixTemplate-Aktionen ---
  async function handleSaveTemplate(tpl) {
    const isNew = !tpl.id;
    const saved = await db.saveFixTemplate(session, tpl);
    if (isNew) await db.applyNewTemplateEverywhere(session, saved, now.getFullYear(), now.getMonth() + 1);
    setModal(null);
    showToast(isNew ? 'Posten in alle Monate übernommen' : 'Posten aktualisiert');
    load();
  }

  async function handleDeleteTemplate(id) {
    if (!confirm('Festen Posten löschen? Bereits übernommene Monatswerte bleiben erhalten.')) return;
    await db.deleteFixTemplate(id);
    setModal(null);
    showToast('Posten gelöscht');
    load();
  }

  async function applyToCurrentMonth() {
    const added = await db.applyMissingFixTemplates(session, now.getFullYear(), now.getMonth() + 1);
    showToast(added > 0 ? `${added} Posten übernommen` : 'Monat bereits aktuell');
  }

  // --- Vertrags-Aktionen ---
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
      <div className="page-header">
        <h1>Laufende Posten</h1>
      </div>

      {/* 1. Einnahmequellen */}
      <TemplateSection
        title="Einnahmequellen"
        description="Feste Einnahmen die automatisch in jeden neuen Monat übernommen werden."
        category="fixeinnahmen"
        templates={templates}
        onEdit={(t) => setModal({ type: 'template', tpl: t, category: 'fixeinnahmen' })}
        onAdd={() => setModal({ type: 'template', tpl: null, category: 'fixeinnahmen' })}
        onApply={applyToCurrentMonth}
      />

      {/* 2. Fixe Ausgaben */}
      <TemplateSection
        title="Fixe Ausgaben"
        description="Feste Kosten die automatisch in jeden neuen Monat übernommen werden."
        category="fixkosten"
        templates={templates}
        onEdit={(t) => setModal({ type: 'template', tpl: t, category: 'fixkosten' })}
        onAdd={() => setModal({ type: 'template', tpl: null, category: 'fixkosten' })}
        onApply={applyToCurrentMonth}
      />

      {/* 3. Verträge */}
      <ContractsSection
        contracts={contracts}
        onEdit={(c) => setModal({ type: 'contract', contract: c })}
        onAdd={() => setModal({ type: 'contract', contract: null })}
        onDelete={handleDeleteContract}
      />

      {/* Modals */}
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
