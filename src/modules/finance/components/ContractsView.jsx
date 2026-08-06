import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import * as db from '../lib/finData';
import { formatEur, formatDate, getContractStatus } from '../lib/finance';
import ContractModal from './ContractModal';
import PaymentBadge from './PaymentBadge';
import { IconEdit, IconTrash } from '../../../core/components/Icons';

const STATUS = {
  active: { label: 'Aktiv', bg: 'var(--success-light)', fg: 'var(--success)' },
  expiring: { label: 'Läuft aus', bg: 'var(--warning-light)', fg: 'var(--warning)' },
  expired: { label: 'Abgelaufen', bg: 'var(--danger-light)', fg: 'var(--danger)' },
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
  const totalMonthly = active.reduce((s, c) => s + Number(c.amount || 0), 0);
  const expiringSoon = active.filter((c) => getContractStatus(c) === 'expiring').length;

  return (
    <>
      <div className="page-header">
        <h1>Verträge</h1>
        <button className="btn btn-primary" onClick={() => setModal({ contract: null })}>+ Vertrag</button>
      </div>

      <div className="summary-row">
        <div className="summary-chip negative"><div className="label">Monatliche Kosten</div><div className="value">{formatEur(totalMonthly)}</div></div>
        <div className="summary-chip"><div className="label">Verträge aktiv</div><div className="value">{active.length}</div></div>
        <div className={`summary-chip ${expiringSoon > 0 ? 'negative' : ''}`}><div className="label">Läuft bald aus</div><div className="value">{expiringSoon}</div></div>
        <div className="summary-chip neutral"><div className="label">Jährliche Kosten</div><div className="value">{formatEur(totalMonthly * 12)}</div></div>
      </div>

      <div className="card">
        <div className="card-title">Laufende Verträge</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="entry-table">
            {contracts.length === 0 ? (
              <tbody>
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  Noch keine Verträge eingetragen
                </td></tr>
              </tbody>
            ) : (
              <>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ textAlign: 'right' }}>Betrag/Mo.</th>
                    <th>Beginn</th><th>Ende</th><th>Zahlung</th><th>Kündigung</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => {
                    const st = getContractStatus(c);
                    return (
                      <tr key={c.id} style={{ opacity: st === 'expired' ? 0.5 : 1 }}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{c.name}</div>
                          {c.duration && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.duration}</div>}
                        </td>
                        <td className="amount" style={{ fontWeight: 600 }}>{formatEur(c.amount)}</td>
                        <td>{c.start_date ? formatDate(c.start_date) : '—'}</td>
                        <td>{c.is_monthly ? 'monatlich' : (c.end_date ? formatDate(c.end_date) : '—')}</td>
                        <td><PaymentBadge payment={c.payment} /></td>
                        <td>{c.cancellation
                          ? <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{c.cancellation}</span>
                          : '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="badge" style={{ background: STATUS[st].bg, color: STATUS[st].fg }}>{STATUS[st].label}</span>
                        </td>
                        <td className="actions">
                          <button className="btn-icon" title="Bearbeiten" onClick={() => setModal({ contract: c })}><IconEdit /></button>
                          <button className="btn-icon" title="Löschen" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c.id)}><IconTrash /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Gesamt (aktiv)</td>
                    <td className="amount" style={{ color: 'var(--danger)' }}>{formatEur(totalMonthly)}</td>
                    <td colSpan="6"></td>
                  </tr>
                </tfoot>
              </>
            )}
          </table>
        </div>
      </div>

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
