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
  // Manche Browser sperren den Kontext bis zur ersten User-Geste
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

/**
 * Spielt einen einzelnen synthetischen Ton.
 * @param {object} opts
 * @param {number} opts.freq       - Frequenz in Hz (Standard: 440)
 * @param {string} opts.type       - OscillatorType: 'sine' | 'triangle' | 'square' | 'sawtooth'
 * @param {number} opts.duration   - Tonlänge in Sekunden (Standard: 0.12)
 * @param {number} opts.gain       - Lautstärke 0–1 (Standard: 0.12)
 * @param {number} opts.startDelay - Verzögerung in Sekunden, relativ zu jetzt (Standard: 0)
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

    // Fade-out: exponentialer Abfall → kein harter Click am Ende
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
  /**
   * ToDo / Gewohnheit abhaken.
   * Helles, kurzes "Ding" — klar und befriedigend, nicht aufdringlich.
   * Zwei aufsteigende Töne dicht hintereinander → kleines "Tock-Ting".
   */
  todoCheck: () => {
    playTone({ freq: 698, type: 'sine', duration: 0.09, gain: 0.10 });                 // F5
    playTone({ freq: 880, type: 'sine', duration: 0.13, gain: 0.12, startDelay: 0.06 }); // A5
  },
};

// ── Vorgefertigte Haptik-Muster ───────────────────────────────────────────────

const HAPTIC = {
  /** Weiches, kurzes Tippen — für einfache Bestätigungen */
  check: () => haptic(40),
};

// ── Öffentliche API (kombinierte Helfer) ──────────────────────────────────────
// Das ist das, was in den Komponenten importiert wird.

export const fb = {
  /**
   * ToDo-Task abhaken.
   * Aufsteigende zwei-Ton-Sequenz + kurzes Haptik-Pulse.
   */
  todoCheck: () => {
    HAPTIC.check();
    SOUND.todoCheck();
  },
};
