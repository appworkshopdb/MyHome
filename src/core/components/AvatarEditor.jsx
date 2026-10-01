import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useUi } from '../lib/UiContext';
import { saveAvatar, removeAvatar, loadImage, drawCrop } from '../lib/avatarData';
import Modal from './Modal';

const PREVIEW = 240;
const OUT = 256;

// Profilbild-Dialog in drei Schritten:
//  view  → aktuelles Bild groß + „Bearbeiten“
//  menu  → Foto hinzufügen/ändern, Ausschnitt anpassen, Entfernen
//  crop  → Ausschnitt per Ziehen + Zoom wählen, dann speichern
export default function AvatarEditor({ avatar, initial, onClose }) {
  const { session } = useAuth();
  const { showToast } = useUi();
  const [step, setStep] = useState('view');
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const off = useRef({ x: 0, y: 0 });
  const drag = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);

  function render(z = zoom) {
    const c = canvasRef.current;
    if (!c || !img) return;
    const r = drawCrop(c.getContext('2d'), img, PREVIEW, z, off.current.x, off.current.y);
    off.current = { x: r.offX, y: r.offY };
  }
  useEffect(() => { if (step === 'crop') render(); }, [step, img, zoom]); // eslint-disable-line

  async function startCrop(src) {
    try {
      setImg(await loadImage(src));
      setZoom(1); off.current = { x: 0, y: 0 };
      setStep('crop');
    } catch (e) { showToast(e.message); }
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => startCrop(reader.result);
    reader.readAsDataURL(file);
  }

  function down(e) { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }
  function move(e) {
    if (!drag.current) return;
    off.current = { x: off.current.x + e.clientX - drag.current.x, y: off.current.y + e.clientY - drag.current.y };
    drag.current = { x: e.clientX, y: e.clientY };
    render();
  }
  function up() { drag.current = null; }

  async function save() {
    setBusy(true);
    try {
      const out = document.createElement('canvas');
      out.width = OUT; out.height = OUT;
      // Offsets sind in Vorschau-Pixeln → auf Ausgabegröße skalieren.
      const k = OUT / PREVIEW;
      drawCrop(out.getContext('2d'), img, OUT, zoom, off.current.x * k, off.current.y * k);
      await saveAvatar(session, out.toDataURL('image/jpeg', 0.85));
      showToast('Profilbild gespeichert');
      onClose();
    } catch (e) {
      showToast('Profilbild konnte nicht gespeichert werden'); console.error(e);
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await removeAvatar(session); showToast('Profilbild entfernt'); onClose(); }
    catch (e) { showToast('Konnte nicht entfernt werden'); console.error(e); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Profilbild" onClose={onClose}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      {step === 'view' && (
        <div className="avatar-editor">
          <div className="avatar-editor-big">{avatar ? <img src={avatar} alt="Profilbild" /> : initial}</div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep('menu')}>Bearbeiten</button>
        </div>
      )}

      {step === 'menu' && (
        <div className="avatar-editor">
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => fileRef.current.click()}>
            {avatar ? 'Neues Foto auswählen' : 'Foto hinzufügen'}
          </button>
          {avatar && (
            <>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => startCrop(avatar)}>Ausschnitt anpassen</button>
              <button className="btn btn-danger" style={{ width: '100%' }} disabled={busy} onClick={remove}>Foto entfernen</button>
            </>
          )}
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setStep('view')}>Zurück</button>
        </div>
      )}

      {step === 'crop' && (
        <div className="avatar-editor">
          <canvas
            ref={canvasRef} width={PREVIEW} height={PREVIEW} className="avatar-crop"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          />
          <p className="profile-section-hint" style={{ margin: 0 }}>Ziehen zum Verschieben, Regler zum Zoomen.</p>
          <input
            type="range" min="1" max="3" step="0.01" value={zoom} style={{ width: '100%' }}
            onChange={(e) => setZoom(+e.target.value)} aria-label="Zoom"
          />
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('menu')}>Abbrechen</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? 'Speichert…' : 'Speichern'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
