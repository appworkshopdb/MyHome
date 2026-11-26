import { useRef, useState } from 'react';
import { useAuth } from '../../../core/lib/AuthContext';
import { useUi } from '../../../core/lib/UiContext';
import * as db from '../lib/finData';
import { IconDownload, IconUpload, IconFile, IconTrash } from '../../../core/components/Icons';
import FocusCard from '../../../core/components/FocusCard';
import SheetShell from '../../../core/components/SheetShell';
import { WizardFoot, WizardFrame } from '../../../core/components/wizard/WizardKit';
import Icon from '../../../core/components/Icon';
import { Button } from '../../../core/components/ui';

// SheetJS erst bei Bedarf nachladen — spart Ladezeit solange niemand
// die XLSX-Migration nutzt.
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js';
    s.onload  = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('SheetJS konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

// Zur Bestätigung muss dieses Wort eingetippt werden (Groß-/Kleinschreibung egal).
const DELETE_WORD = 'Löschen';
const isDeleteWord = (v) => v.trim().toLocaleLowerCase('de') === DELETE_WORD.toLocaleLowerCase('de');

// Fenster "Alle Finanzdaten löschen?": der rote Knopf wird erst aktiv, wenn
// das Wort "Löschen" getippt wurde.
function DeleteSheet({ onConfirm, onClose, busy }) {
  const [typed, setTyped] = useState('');
  const ok = isDeleteWord(typed);
  const footer = (
    <WizardFoot>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Abbrechen</Button>
      <Button variant="danger" onClick={onConfirm} disabled={!ok || busy}>Alle Daten löschen</Button>
    </WizardFoot>
  );
  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame title="Alle Finanzdaten löschen?" onClose={onClose} footer={footer}>
        <p className="se-text">
          Einträge, Sparschwein, Verträge und Vorlagen werden gelöscht, auch auf deinen anderen
          Geräten. Das lässt sich nicht rückgängig machen.
        </p>
        <label className="wz-lbl" htmlFor="se-del-word">Zur Bestätigung „{DELETE_WORD}“ eintippen</label>
        <input
          id="se-del-word" className="wz-input hero" type="text" value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && ok && !busy) onConfirm(); }}
          placeholder={DELETE_WORD} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        />
      </WizardFrame>
    </SheetShell>
  );
}

// Fenster "Excel-Datei lesen": gefundene Daten, noch nichts importiert.
function ExcelSheet({ fileName, preview, onConfirm, onClose, busy }) {
  const footer = (
    <WizardFoot>
      <Button variant="secondary" onClick={onClose} disabled={busy}>Abbrechen</Button>
      <Button onClick={onConfirm} disabled={busy}>Jetzt importieren</Button>
    </WizardFoot>
  );
  return (
    <SheetShell onClose={onClose} wizard>
      <WizardFrame title="Excel-Datei lesen" onClose={onClose} footer={footer}>
        <div className="wz-lbl">Datei</div>
        <div className="se-file"><span>{fileName}</span><b aria-label="gelesen"><Icon name="check" size={null} className="glyph" /></b></div>
        <div className="se-stats">
          <div className="se-stat"><b>{preview.entries.length}</b><span>Einträge</span></div>
          <div className="se-stat"><b>{preview.savings.length}</b><span>Monate Ersparnisse</span></div>
        </div>
        <p className="se-hint">Vorschau — gefundene Daten</p>
      </WizardFrame>
    </SheetShell>
  );
}

export default function SettingsView() {
  const { session }   = useAuth();
  const { showToast } = useUi();

  const [importStatus, setImportStatus] = useState(null);
  const [xlsxStatus,   setXlsxStatus]   = useState(null);
  const [xlsxPreview,  setXlsxPreview]  = useState(null);
  const [xlsxName,     setXlsxName]     = useState('');
  const [deleting,     setDeleting]     = useState(false);   // Lösch-Fenster offen
  const [busy,         setBusy]         = useState(false);

  const jsonRef = useRef(null);
  const xlsxRef = useRef(null);

  const now = new Date();

  async function exportJSON() {
    try {
      const data = await db.exportAllData(session);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
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
      const XLSX   = await loadSheetJS();
      const wb     = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const parsed = db.parseXlsxWorkbook(XLSX, wb, now.getFullYear());
      setXlsxName(file.name);
      setXlsxPreview(parsed);
      setXlsxStatus(null);
    } catch (err) {
      setXlsxStatus({ type: 'error', text: '✗ Fehler: ' + err.message });
    }
    e.target.value = '';
  }

  async function confirmXLSX() {
    setBusy(true);
    try {
      await db.saveXlsxImport(session, xlsxPreview.entries, xlsxPreview.savings);
      setXlsxStatus({ type: 'ok', text: `✓ ${xlsxPreview.entries.length} Einträge importiert` });
      setXlsxPreview(null);
      showToast('XLSX erfolgreich importiert');
    } catch (err) {
      setXlsxPreview(null);
      setXlsxStatus({ type: 'error', text: '✗ Import fehlgeschlagen: ' + err.message });
    }
    setBusy(false);
  }

  async function clearAll() {
    setBusy(true);
    try {
      await db.deleteAllData(session);
      setDeleting(false);
      showToast('Alle Daten gelöscht');
    } catch (e) {
      showToast('Löschen fehlgeschlagen');
      console.error(e);
    }
    setBusy(false);
  }

  return (
    <div className="se-page">
      <FocusCard>
        <FocusCard.Eyebrow>Sicherung</FocusCard.Eyebrow>
        <div className="se-title">Backup erstellen</div>
        <FocusCard.Meta>Alle Einträge, Sparschwein und Verträge als JSON-Datei</FocusCard.Meta>
        <div className="se-hero-act">
          <FocusCard.Pill onPress={exportJSON}><IconDownload /> JSON exportieren</FocusCard.Pill>
        </div>
      </FocusCard>

      <div className="se-two">
        <button type="button" className="se-btn" onClick={() => jsonRef.current?.click()}><IconUpload /> Importieren</button>
        <button type="button" className="se-btn" onClick={() => xlsxRef.current?.click()}><IconFile /> Aus Excel</button>
      </div>
      <input ref={jsonRef} type="file" accept=".json" onChange={importJSON} hidden />
      <input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={readXLSX} hidden />
      <p className="se-hint">Import überschreibt gleiche Einträge, neue kommen dazu.</p>
      {importStatus && <div className={`status-note ${importStatus.type}`}>{importStatus.text}</div>}
      {xlsxStatus && <div className={`status-note ${xlsxStatus.type}`}>{xlsxStatus.text}</div>}

      <section className="se-group">
        <h2 className="se-gl">Gefahrenbereich</h2>
        <button type="button" className="se-del" onClick={() => setDeleting(true)}><IconTrash size={18} /> Alle Daten löschen</button>
      </section>

      <p className="se-foot">Hell/Dunkel: Zahnrad im Menü. Konto und Abmelden: Profil oben rechts.</p>

      {xlsxPreview && (
        <ExcelSheet fileName={xlsxName} preview={xlsxPreview} busy={busy} onConfirm={confirmXLSX} onClose={() => setXlsxPreview(null)} />
      )}
      {deleting && <DeleteSheet busy={busy} onConfirm={clearAll} onClose={() => setDeleting(false)} />}
    </div>
  );
}
