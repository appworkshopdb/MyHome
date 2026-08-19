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
} from '../lib/finance';
import ContractModal from './ContractModal';
import PaymentBadge from './PaymentBadge';
import { IconEdit, IconTrash } from '../../../core/components/Icons';

const STATUS = {
  active:   { label: 'Aktiv',       bg: 'var(--success-light)', fg: 'var(--success)' },
  expiring: { label: 'Läuft aus',   bg: 'var(--warning-light)', fg: 'var(--warning)' },
  expired:  { label: 'Abgelaufen', bg: 'var(--danger-light)',  fg: 'var(--danger)'  },
};

export default function ContractsView() {
  const { session } = useAuth();
  const { showToast } = useUi();
  const [contracts, setContracts] = useState([]);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setContracts(await db.getContracts(session));
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(c) {
    await db.saveContract(session, c);
    setModal(null);
    showToast(c.id ? 'Vertrag aktualisiert' : 'Vertrag hinzugefügt');
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Vertrag löschen?')) return;
    await db.deleteContract(id);
    showToast('Vertrag gelöscht');
    load();
  }

  const active = contracts.filter((c) => getContractStatus(c) !== 'expired');
  const expired = contracts.filter((c) => getContractStatus(c) === 'expired');

  // Monatliche Gesamtkosten aller aktiven Verträge
  const totalMonthly = active.reduce(
    (s, c) => s + monthlyAmount(c.amount, c.interval ?? (c.quarterly ? 'quarterly' : 'monthly')),
    0
  );
  const expiringSoon = active.filter((c) => getContractStatus(c) === 'expiring').length;

  function renderRow(c) {
    const st = getContractStatus(c);
    const interval = c.interval ?? (c.quarterly ? 'quarterly' : 'monthly');
    const endDate = getContractEndDate(c);
    const monthly = monthlyAmount(c.amount, interval);

    return (
      <tr key={c.id} style={{ opacity: st === 'expired' ? 0.5 : 1 }}>
        <td>
          <div style={{ fontWeight: 500 }}>{c.name}</div>
          {c.notes && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.notes}</div>
          )}
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 600 }}>{formatEur(c.amount)}</div>
          {interval !== 'monthly' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {intervalLabel(interval)}
              <br />≈ {formatEur(monthly)}/Mo.
            </div>
          )}
        </td>
        <td style={{ fontSize: '0.85rem' }}>
          {c.start_date ? formatDate(c.start_date) : '—'}
        </td>
        <td style={{ fontSize: '0.85rem' }}>
          {c.is_open || c.is_monthly
            ? <span style={{ color: 'var(--text-muted)' }}>unbefristet</span>
            : endDate
              ? formatDate(endDate)
              : '—'}
        </td>
        <td><PaymentBadge payment={c.payment} /></td>
        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {c.cancellation || '—'}
        </td>
        <td>
          <span
            className="badge"
            style={{ background: STATUS[st].bg, color: STATUS[st].fg, whiteSpace: 'nowrap' }}
          >
            {STATUS[st].label}
          </span>
        </td>
        <td className="actions">
          <button
            className="btn-icon"
            title="Bearbeiten"
            onClick={() => setModal({ contract: c })}
          >
            <IconEdit />
          </button>
          <button
            className="btn-icon"
            title="Löschen"
            style={{ color: 'var(--danger)' }}
            onClick={() => handleDelete(c.id)}
          >
            <IconTrash />
          </button>
        </td>
      </tr>
    );
  }

  function renderTable(rows, emptyText) {
    if (rows.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {emptyText}
        </div>
      );
    }
    return (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="entry-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Betrag</th>
              <th>Beginn</th>
              <th>Ende</th>
              <th>Zahlung</th>
              <th>Kündigung</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(renderRow)}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Verträge</h1>
        <button className="btn btn-primary" onClick={() => setModal({ contract: null })}>
          + Vertrag
        </button>
      </div>

      {/* Kennzahlen */}
      <div className="summary-row">
        <div className="summary-chip negative">
          <div className="label">Kosten/Monat</div>
          <div className="value">{formatEur(totalMonthly)}</div>
        </div>
        <div className="summary-chip">
          <div className="label">Aktive Verträge</div>
          <div className="value">{active.length}</div>
        </div>
        <div className={`summary-chip ${expiringSoon > 0 ? 'negative' : ''}`}>
          <div className="label">Läuft bald aus</div>
          <div className="value">{expiringSoon}</div>
        </div>
        <div className="summary-chip neutral">
          <div className="label">Kosten/Jahr</div>
          <div className="value">{formatEur(totalMonthly * 12)}</div>
        </div>
      </div>

      {/* Aktive Verträge */}
      <div className="card">
        <div className="card-title">Laufende Verträge</div>
        {renderTable(active, 'Noch keine Verträge eingetragen')}

        {active.length > 0 && (
          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Gesamt monatlich (aktiv)</span>
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{formatEur(totalMonthly)}</span>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => setModal({ contract: null })}>
            + Vertrag hinzufügen
          </button>
        </div>
      </div>

      {/* Abgelaufene Verträge — nur anzeigen wenn vorhanden */}
      {expired.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ color: 'var(--text-muted)' }}>
            Abgelaufene Verträge ({expired.length})
          </div>
          {renderTable(expired, '')}
        </div>
      )}

      {modal && (
        <ContractModal
          contract={modal.contract}
          onSave={handleSave}
          onClose={() => setModal(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
