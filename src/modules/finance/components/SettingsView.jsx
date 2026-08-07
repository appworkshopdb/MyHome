import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import * as rawAuth from '../../../core/lib/rawAuth';
import * as db from '../lib/finData';
import { FIX_TEMPLATE_CATEGORIES, formatEur, MONTHS_DE } from '../lib/finance';
import { THEMES, THEME_LABELS, THEME_PREVIEW } from '../../../core/lib/theme';
import FixTemplateModal from './FixTemplateModal';
import PaymentBadge from './PaymentBadge';
import { IconDownload, IconUpload, IconFile } from '../../../core/components/Icons';

// SheetJS erst bei Bedarf nachladen (wie im Original) — spart Ladezeit,
// solange niemand die XLSX-Migration nutzt.
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('SheetJS konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

export default function SettingsView() {
  const { session, setSession } = useAuth();
  const { theme, setTheme, showToast } = useUi();
  const [templates, setTemplates] = useState([]);
  const [modal, setModal] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [xlsxStatus, setXlsxStatus] = useState(null);
  const [xlsxPreview, setXlsxPreview] = useState(null);

  const now = new Date();

  const load = useCallback(async () => {
    const data = await db.getFixTemplates(session);
    const order = { fixeinnahmen: 0, fixkosten: 1 };
    data.sort((a, b) => (order[a.category] - order[b.category]) || a.name.localeCompare(b.name));
    setTemplates(data);
  }, [session]);

  useEffect(() => { load(); }, [load]);

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

  async function exportJSON() {
    try {
      const data = await db.exportAllData(session);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finanzen-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export erfolgreich');
    } catch (e) {
      showToast('Export fehlgeschlagen');
      console.error(e);
    }
  }

  async function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus({ type: '', text: 'Wird importiert…' });
    try {
      const data = JSON.parse(await file.text());
      if (!data.version || !data.entries) throw new Error('Ungültiges Format');
      const c = await db.importLegacyBackup(session, data, now.getFullYear(), now.getMonth() + 1);
      setImportStatus({
        type: 'ok',
        text: `✓ ${c.entries} Buchungen, ${c.contracts} Verträge, ${c.fixtemplates} Vorlagen, ${c.savings} Sparbeträge` +
          (c.paymentFixed > 0 ? ` · ${c.paymentFixed}× unbekannte Zahlungsart auf „Bank" gesetzt` : ''),
      });
      showToast('Import erfolgreich');
      load();
    } catch (err) {
      setImportStatus({ type: 'error', text: '✗ Import fehlgeschlagen: ' + err.message });
    }
    e.target.value = '';
  }

  async function readXLSX(e) {
    const file = e.target.files[0];
    if (!file) return;
    setXlsxStatus({ type: '', text: 'Wird gelesen…' });
    try {
      const XLSX = await loadSheetJS();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const parsed = db.parseXlsxWorkbook(XLSX, wb, now.getFullYear());
      setXlsxPreview(parsed);
      setXlsxStatus({ type: 'ok', text: '✓ Datei gelesen' });
    } catch (err) {
      setXlsxStatus({ type: 'error', text: '✗ Fehler: ' + err.message });
    }
    e.target.value = '';
  }

  async function confirmXLSX() {
    try {
      await db.saveXlsxImport(session, xlsxPreview.entries, xlsxPreview.savings);
      setXlsxStatus({ type: 'ok', text: `✓ ${xlsxPreview.entries.length} Einträge importiert` });
      setXlsxPreview(null);
      showToast('XLSX erfolgreich importiert');
    } catch (err) {
      setXlsxStatus({ type: 'error', text: '✗ Import fehlgeschlagen: ' + err.message });
    }
  }

  async function clearAll() {
    if (!confirm('Wirklich alle Daten löschen? Das kann nicht rückgängig gemacht werden.')) return;
    if (!confirm('Bist du sicher? Alle Einträge, Ersparnisse und Verträge werden gelöscht.')) return;
    try {
      await db.deleteAllData(session);
      showToast('Alle Daten gelöscht');
      load();
    } catch (e) {
      showToast('Löschen fehlgeschlagen');
      console.error(e);
    }
  }

  return (
    <>
      <div className="page-header"><h1>Einstellungen</h1></div>

      {/* Feste monatliche Posten */}
      <div className="card">
        <div className="card-title">Feste monatliche Posten</div>
        <p style={{ marginBottom: 14, fontSize: '0.9rem' }}>
          Diese Posten (Fixeinnahmen &amp; Fixkosten) werden automatisch in jeden
          neuen Monat übernommen. Tippe einen Posten an, um ihn zu ändern.
        </p>

        {templates.length === 0 ? (
          <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', padding: '6px 0' }}>
            Noch keine festen Posten angelegt.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="entry-table">
              <thead>
                <tr>
                  <th>Name</th><th>Art</th><th>Zahlung</th><th style={{ textAlign: 'right' }}>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="entry-row" style={{ cursor: 'pointer' }} onClick={() => setModal({ tpl: t })}>
                    <td>
                      {t.name}
                      {t.quarterly && (
                        <><br /><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          alle 3 Monate ab {MONTHS_DE[(t.start_month || 1) - 1]}
                        </span></>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {FIX_TEMPLATE_CATEGORIES[t.category] || t.category}
                    </td>
                    <td><PaymentBadge payment={t.payment} /></td>
                    <td className="amount">{formatEur(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => setModal({ tpl: null })}>+ Posten</button>
          <button className="btn btn-secondary" onClick={applyToCurrentMonth}>Auf aktuellen Monat anwenden</button>
        </div>
      </div>

      {/* Darstellung */}
      <div className="card">
        <div className="card-title">Darstellung</div>
        <p style={{ marginBottom: 12, fontSize: '0.9rem' }}>Farbvorlage</p>
        <div className="theme-grid">
          {THEMES.map((t) => {
            const p = THEME_PREVIEW[t];
            return (
              <button key={t} className={`theme-option ${t === theme ? 'active' : ''}`} onClick={() => setTheme(t)}>
                <span className="theme-swatch">
                  <span style={{ background: p.light }} />
                  <span style={{ background: p.accent }} />
                  <span style={{ background: p.dark }} />
                </span>
                <span className="theme-name">{THEME_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
        <p style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Hell/Dunkel/System gilt jetzt app-weit — umschaltbar oben im Menü.
        </p>
      </div>

      {/* Export */}
      <div className="card">
        <div className="card-title">Daten exportieren</div>
        <p style={{ marginBottom: 14, fontSize: '0.9rem' }}>
          Exportiert alle Einträge, Ersparnisse und Verträge als JSON-Datei — als
          zusätzliches Backup. Die eigentliche Synchronisation zwischen deinen
          Geräten läuft automatisch über die Cloud.
        </p>
        <button className="btn btn-primary" onClick={exportJSON}><IconDownload /> JSON exportieren</button>
      </div>

      {/* Import */}
      <div className="card">
        <div className="card-title">Daten importieren</div>
        <p style={{ marginBottom: 14, fontSize: '0.9rem' }}>
          Importiert eine zuvor exportierte JSON-Datei — auch aus der alten,
          lokalen Version der App. Bestehende Einträge mit gleicher ID werden
          überschrieben, neue hinzugefügt.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <IconUpload /> JSON importieren
            <input type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
          </label>
        </div>
        {importStatus && <div className={`status-note ${importStatus.type}`}>{importStatus.text}</div>}
      </div>

      {/* XLSX */}
      <div className="card">
        <div className="card-title">XLSX Migration</div>
        <p style={{ marginBottom: 14, fontSize: '0.9rem' }}>
          Importiere deine bestehende Google Sheets / Excel-Datei einmalig in die App.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <IconFile /> XLSX importieren
            <input type="file" accept=".xlsx,.xls" onChange={readXLSX} style={{ display: 'none' }} />
          </label>
        </div>
        {xlsxStatus && <div className={`status-note ${xlsxStatus.type}`}>{xlsxStatus.text}</div>}

        {xlsxPreview && (
          <div style={{ marginTop: 14, background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', padding: 14, fontSize: '0.88rem' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>Vorschau — gefundene Daten</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: 'var(--text-secondary)' }}>
              <span>Einträge:</span><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{xlsxPreview.entries.length}</span>
              <span>Ersparnisse:</span><span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{xlsxPreview.savings.length} Monate</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={confirmXLSX}>Jetzt importieren</button>
              <button className="btn btn-secondary" onClick={() => setXlsxPreview(null)}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>

      {/* Daten löschen */}
      <div className="card">
        <div className="card-title" style={{ color: 'var(--danger)' }}>Daten löschen</div>
        <p style={{ marginBottom: 14, fontSize: '0.9rem' }}>
          Löscht alle gespeicherten Daten unwiderruflich aus deinem Konto — auch
          auf allen anderen Geräten.
        </p>
        <button className="btn btn-danger" onClick={clearAll}>Alle Daten löschen</button>
      </div>

      {/* Konto */}
      <div className="card">
        <div className="card-title">Konto</div>
        <p style={{ marginBottom: 14, fontSize: '0.9rem' }}>{session.user.email}</p>
        <button className="btn btn-danger" onClick={() => { rawAuth.signOut(); setSession(null); }}>Abmelden</button>
      </div>

      <div style={{ textAlign: 'center', padding: '20px 0 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        Zuhause · Finanzen-Modul · Cloud-Sync über Supabase
      </div>

      {modal && (
        <FixTemplateModal
          tpl={modal.tpl}
          currentMonth={now.getMonth() + 1}
          currentYear={now.getFullYear()}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
          onClose={() => setModal(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
