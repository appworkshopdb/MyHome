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
} from '../lib/finance';
import ContractModal from './ContractModal';
import FixTemplateModal from './FixTemplateModal';
import PaymentBadge from './PaymentBadge';

const STATUS_MAP = {
  active:   { label: 'Aktiv',      bg: 'var(--status-positive-bg)', fg: 'var(--status-positive)' },
  expiring: { label: 'Läuft aus',  bg: 'var(--status-caution-bg)',  fg: 'var(--status-caution)'  },
  expired:  { label: 'Abgelaufen', bg: 'var(--status-critical-bg)', fg: 'var(--status-critical)' },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.active;
  return (
    <span className="t-chip" style={{
      background: s.bg, color: s.fg,
      padding: '2px 7px', borderRadius: 'var(--r-pill)',
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {s.label}
    </span>
  );
}

// Zeigt due_day + Intervall als lesbaren Hinweis
function DueDayHint({ dueDay, interval }) {
  if (!dueDay) return null;
  const iv = INTERVALS[interval];
  const suffix = iv && iv.months > 1 ? ` · alle ${iv.months} Monate` : ' · monatlich';
  return (
    <span className="t-meta" style={{ color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
      fällig am {dueDay}.{suffix}
    </span>
  );
}

// ── Einzel-Zeile ─────────────────────────────────────────────────────────────
function TemplateRow({ t, onClick }) {
  const iv      = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
  const monthly = monthlyAmount(t.amount, iv);
  const st      = getTemplateStatus(t);
  const endDate = getTemplateEndDate(t);

  return (
    <div
      className={`contracts-row ${st === 'expired' ? 'contracts-row--faded' : ''}`}
      onClick={() => onClick(t)}
    >
      <div className="contracts-row-main">
        <div className="t-body" style={{ fontWeight: 600 }}>{t.name}</div>
        <DueDayHint dueDay={t.due_day} interval={iv} />
        {iv !== 'monthly' && (
          <span className="t-meta" style={{ color: 'var(--text-muted)' }}>
            {intervalLabel(iv)}
          </span>
        )}
      </div>
      <div className="contracts-row-right">
        <PaymentBadge payment={t.payment} />
        <div style={{ textAlign: 'right' }}>
          <div className="t-body" style={{ fontWeight: 700 }}>{formatEur(t.amount)}</div>
          {iv !== 'monthly' && (
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>≈ {formatEur(monthly)}/Mo.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContractRow({ c, onClick }) {
  const iv      = c.interval ?? (c.quarterly ? 'quarterly' : 'monthly');
  const monthly = monthlyAmount(c.amount, iv);
  const st      = getContractStatus(c);

  return (
    <div
      className={`contracts-row ${st === 'expired' ? 'contracts-row--faded' : ''}`}
      onClick={() => onClick(c)}
    >
      <div className="contracts-row-main">
        <div className="t-body" style={{ fontWeight: 600 }}>{c.name}</div>
        <DueDayHint dueDay={c.due_day} interval={iv} />
        {st === 'expiring' && <StatusBadge status="expiring" />}
        {c.notes && (
          <span className="t-meta" style={{ color: 'var(--text-muted)' }}>{c.notes}</span>
        )}
      </div>
      <div className="contracts-row-right">
        <PaymentBadge payment={c.payment} />
        <div style={{ textAlign: 'right' }}>
          <div className="t-body" style={{ fontWeight: 700 }}>{formatEur(c.amount)}</div>
          {iv !== 'monthly' && (
            <div className="t-meta" style={{ color: 'var(--text-muted)' }}>≈ {formatEur(monthly)}/Mo.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Einnahmen-Sektion ─────────────────────────────────────────────────────────
function EinnahmenSection({ templates, onEdit, onAdd }) {
  const [expiredOpen, setExpiredOpen] = useState(false);

  const items   = templates.filter((t) => t.category === 'fixeinnahmen');
  const active  = items.filter((t) => getTemplateStatus(t) !== 'expired');
  const expired = items.filter((t) => getTemplateStatus(t) === 'expired');

  const totalMonthly = active.reduce((s, t) => {
    const iv = t.interval ?? (t.quarterly ? 'quarterly' : 'monthly');
    return s + monthlyAmount(t.amount, iv);
  }, 0);

  return (
    <div className="card">
      <div className="card-title">Einnahmen</div>

      {items.length === 0 ? (
        <p className="t-body" style={{ color: 'var(--text-muted)', padding: '6px 0 10px' }}>
          Noch keine Einnahmequellen angelegt.
        </p>
      ) : (
        <>
          {/* Aktive — immer sichtbar */}
          {active.map((t) => (
            <TemplateRow key={t.id} t={t} onClick={onEdit} />
          ))}

          {/* Gesamt */}
          {active.length > 0 && (
            <div className="contracts-total-row">
              <span className="t-meta">Gesamt/Monat</span>
              <span className="t-body" style={{ color: 'var(--status-positive)', fontWeight: 700 }}>
                {formatEur(totalMonthly)}
              </span>
            </div>
          )}

          {/* Abgelaufene — eingeklappt */}
          {expired.length > 0 && (
            <div className="contracts-expired-toggle">
              <button
                className="contracts-expired-btn t-meta"
                onClick={() => setExpiredOpen((o) => !o)}
              >
                Abgelaufen ({expired.length}) {expiredOpen ? '▲' : '▼'}
              </button>
              {expiredOpen && expired.map((t) => (
                <TemplateRow key={t.id} t={t} onClick={onEdit} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="contracts-btn-row">
        <button className="btn btn-primary" onClick={onAdd}>+ Hinzufügen</button>
      </div>
    </div>
  );
}

// ── Fixkosten & Verträge-Sektion ─────────────────────────────────────────────
function FixkostenSection({ templates, contracts, onEditTemplate, onAdd, onEditContract, onDeleteContract }) {
  const [expiredOpen, setExpiredOpen] = useState(false);

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

  return (
    <div className="card">
      <div className="card-title">Fixkosten &amp; Verträge</div>

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
              <div className="label">Läuft aus</div>
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
          {active.map((x) =>
            x._src === 'template'
              ? <TemplateRow key={`t-${x.id}`} t={x} onClick={onEditTemplate} />
              : <ContractRow key={`c-${x.id}`} c={x} onClick={onEditContract} />
          )}

          {active.length > 0 && (
            <div className="contracts-total-row">
              <span className="t-meta">Gesamt/Monat</span>
              <span className="t-body" style={{ color: 'var(--status-critical)', fontWeight: 700 }}>
                {formatEur(totalMonthly)}
              </span>
            </div>
          )}

          {expired.length > 0 && (
            <div className="contracts-expired-toggle">
              <button
                className="contracts-expired-btn t-meta"
                onClick={() => setExpiredOpen((o) => !o)}
              >
                Abgelaufen ({expired.length}) {expiredOpen ? '▲' : '▼'}
              </button>
              {expiredOpen && expired.map((x) =>
                x._src === 'template'
                  ? <TemplateRow key={`t-${x.id}`} t={x} onClick={onEditTemplate} />
                  : <ContractRow key={`c-${x.id}`} c={x} onClick={onEditContract} />
              )}
            </div>
          )}
        </>
      )}

      <div className="contracts-btn-row">
        <button className="btn btn-primary" onClick={onAdd}>+ Hinzufügen</button>
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
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
    const { _src, ...cleanTpl } = { _src: undefined, ...tpl };
    const saved = await db.saveFixTemplate(session, cleanTpl);
    if (isNew) await db.applyNewTemplateEverywhere(session, saved, now.getFullYear(), now.getMonth() + 1);
    setModal(null);
    showToast(isNew ? 'Posten hinzugefügt' : 'Posten aktualisiert');
    load();
  }

  async function handleDeleteTemplate(id) {
    if (!confirm('Posten löschen? Bereits übernommene Monatswerte bleiben erhalten.')) return;
    await db.deleteFixTemplate(session, id);
    setModal(null);
    showToast('Posten gelöscht');
    load();
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

  // Kombinierter "+" Button öffnet FixTemplateModal mit initialCategory
  // 'fixkosten' — Nutzer kann oben auf 'fixeinnahmen' wechseln.
  // Für Verträge: eigenes ContractModal bleibt erhalten, erreichbar über
  // Antippen eines bestehenden Vertrags (Edit) oder über den kombinierten
  // Wizard (TODO: könnte in Zukunft in FixTemplateModal integriert werden).
  // Aktuell: "+" öffnet Fixkosten-Wizard, bestehende Verträge per Tap.

  return (
    <>
      <EinnahmenSection
        templates={templates}
        onEdit={(t) => setModal({ type: 'template', tpl: t, category: t.category })}
        onAdd={() => setModal({ type: 'template', tpl: null, category: 'fixeinnahmen' })}
      />

      <FixkostenSection
        templates={templates}
        contracts={contracts}
        onEditTemplate={(t) => setModal({ type: 'template', tpl: t, category: t.category })}
        onAdd={() => setModal({ type: 'combined', tpl: null })}
        onEditContract={(c) => setModal({ type: 'contract', contract: c })}
        onDeleteContract={handleDeleteContract}
      />

      {/* Fixkosten/Einnahme-Wizard (kombiniert) */}
      {(modal?.type === 'template' || modal?.type === 'combined') && (
        <FixTemplateModal
          tpl={modal.tpl}
          initialCategory={modal.category || 'fixkosten'}
          currentMonth={now.getMonth() + 1}
          currentYear={now.getFullYear()}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
          onClose={() => setModal(null)}
          showToast={showToast}
        />
      )}

      {/* Vertrag bearbeiten */}
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
