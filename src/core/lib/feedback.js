// src/core/lib/feedback.js
// Haptik + Sound für die Zuhause-App.
// Kein Package, kein CDN — nur Web Audio API + Vibration API.
// Einstellungen liegen in localStorage, kein React-Context nötig.
// Einfach importieren und aufrufen: import { fb } from '../lib/feedback';

const STORAGE_KEY = 'zuhause_feedback';

// ── Einstellungen ─────────────────────────────────────────────────────────────

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function isSoundEnabled() {
  return getSettings().sound !== false; // Default: an
}

export function isHapticEnabled() {
  return getSettings().haptic !== false; // Default: an
}

export function setSoundEnabled(v) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getSettings(), sound: v }));
}

export function setHapticEnabled(v) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...getSettings(), haptic: v }));
}

// ── Haptik (Vibration API) ────────────────────────────────────────────────────
// Funktioniert auf Android Chrome/TWA. iOS Safari ignoriert das stillschweigend.

export function haptic(pattern = 30) {
  if (!isHapticEnabled()) return;
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// ── Sound (Web Audio API) ─────────────────────────────────────────────────────
// Kein Audio-File, kein CDN. Töne werden synthetisch erzeugt.
// AudioContext wird lazy erstellt — muss nach einer User-Geste passieren,
// sonst sperrt der Browser ihn (Autoplay-Policy). Da alle fb.*-Aufrufe
// direkt in onClick/onTap-Handlern stehen, ist das garantiert erfüllt.

let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

/**
 * Spielt einen einzelnen synthetischen Ton.
 * @param {number} freq       - Frequenz in Hz
 * @param {string} type       - OscillatorType: 'sine' | 'triangle' | 'square' | 'sawtooth'
 * @param {number} duration   - Tonlänge in Sekunden
 * @param {number} gain       - Lautstärke 0–1
 * @param {number} startDelay - Verzögerung in Sekunden, relativ zu jetzt
 */
function playTone({ freq = 440, type = 'sine', duration = 0.12, gain = 0.12, startDelay = 0 } = {}) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime + startDelay;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // AudioContext gesperrt oder nicht verfügbar → still ignorieren
  }
}

// ── Vorgefertigte Sounds ──────────────────────────────────────────────────────

const SOUND = {
  // Einzelnes Abhaken (ToDo / Gewohnheit / Einkauf-Artikel)
  // Zwei aufsteigende Töne dicht hintereinander → kleines "Tock-Ting"
  check: () => {
    playTone({ freq: 698, type: 'sine', duration: 0.09, gain: 0.10 });                  // F5
    playTone({ freq: 880, type: 'sine', duration: 0.13, gain: 0.12, startDelay: 0.06 }); // A5
  },

  // Alle Gewohnheiten des Tages erledigt — aufsteigender Dreiklang C5→E5→G5
  allDone: () => {
    playTone({ freq: 523, type: 'sine', duration: 0.12, gain: 0.11 });
    playTone({ freq: 659, type: 'sine', duration: 0.12, gain: 0.12, startDelay: 0.10 });
    playTone({ freq: 784, type: 'sine', duration: 0.20, gain: 0.13, startDelay: 0.20 });
  },

  // Liste angelegt — kurzer absteigender Swoosh (hoch → tief)
  listCreate: () => {
    playTone({ freq: 660, type: 'sine', duration: 0.06, gain: 0.09 });
    playTone({ freq: 440, type: 'sine', duration: 0.10, gain: 0.11, startDelay: 0.05 });
  },

  // Artikel hinzugefügt — weiches "Pop" (einzelner mittlerer Ton)
  itemAdd: () => {
    playTone({ freq: 520, type: 'sine', duration: 0.08, gain: 0.10 });
  },
};

// ── Vorgefertigte Haptik-Muster ───────────────────────────────────────────────

const HAPTIC = {
  // Weiches, kurzes Tippen — für einfache Bestätigungen
  check: () => haptic(40),

  // Sehr sanft — für Hinzufügen-Aktionen
  soft: () => haptic(20),

  // Doppel-Puls — für besondere Momente (alle erledigt, Workout fertig)
  success: () => haptic([50, 80, 50]),
};

// ── Öffentliche API ───────────────────────────────────────────────────────────

export const fb = {
  // ── ToDo ──
  // Task abhaken (nur beim Erledigen, nicht beim Rückgängig)
  todoCheck: () => {
    HAPTIC.check();
    SOUND.check();
  },

  // ── Gewohnheiten ──
  // Einzelne Gewohnheit abhaken
  habitCheck: () => {
    HAPTIC.check();
    SOUND.check();
  },

  // Alle Gewohnheiten des Tages erledigt — besonderer Moment
  habitAllDone: () => {
    HAPTIC.success();
    SOUND.allDone();
  },

  // ── Einkauf ──
  // Artikel abhaken
  itemCheck: () => {
    HAPTIC.check();
    SOUND.check();
  },

  // Liste neu angelegt — Swoosh
  listCreate: () => {
    HAPTIC.soft();
    SOUND.listCreate();
  },

  // Artikel zur Liste hinzugefügt — Pop
  itemAdd: () => {
    HAPTIC.soft();
    SOUND.itemAdd();
  },
};
