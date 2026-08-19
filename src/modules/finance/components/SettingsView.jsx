import { useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import * as db from '../lib/finData';
import GoalsSection from '../../../core/components/GoalsSection';
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
  const { session } = useAuth();
  const { showToast } = useUi();
  const [importStatus, setImportStatus] = useState(null);
  const [xlsxStatus, setXlsxStatus] = useState(null);
  const [xlsxPreview, setXlsxPreview] = useState(null);

  const now = new Date();

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
    } catch (e) {
      showToast('Löschen fehlgeschlagen');
      console.error(e);
    }
  }

  return (
    <>
      <div className="page-header"><h1>Einstellungen</h1></div>

      <GoalsSection sourceModule="finance" />

      {/* Darstellung */}
      <div className="card">
        <div className="card-title">Darstellung</div>
        <p style={{ fontSize: '0.9rem' }}>
          Hell/Dunkel/System gilt app-weit — umschaltbar oben im Menü.
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

      <p style={{ textAlign: 'center', margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Konto, Passwort und Abmelden findest du im Profil-Menü oben rechts.
      </p>

      <div style={{ textAlign: 'center', padding: '20px 0 8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        Zuhause · Finanzen-Modul · Cloud-Sync über Supabase
      </div>
    </>
  );
}
