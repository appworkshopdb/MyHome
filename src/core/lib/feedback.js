// src/core/lib/feedback.js
// Haptik + Sound für die Zuhause-App.
// Sounds liegen als Dateien in public/sounds/ und werden per Audio-API abgespielt.
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

// ── Sound-Dateien vorladen ────────────────────────────────────────────────────
// Alle Sounds beim ersten Import vorladen damit kein Delay beim ersten Abspielen.
// Audio-Objekte werden wiederverwendet (cloneNode) um paralleles Abspielen zu ermöglichen.

const SOUND_FILES = {
  erledigt:      './sounds/erledigt.wav',
  ziel_erreicht: './sounds/ziel_erreicht.wav',
  ziel_erreicht2:'./sounds/ziel_erreicht2.wav',
  click:         './sounds/click.mp3',
  click2:        './sounds/click2.wav',
  swoosh:        './sounds/swoosh.wav',
  negativ:       './sounds/negativ.wav',
  zahlung:       './sounds/zahlung.wav',
  fixkosten_alle:'./sounds/fixkosten_alle.wav',
};

// Cache: name → Audio-Objekt (vorgeladen)
const _audioCache = {};

function preload() {
  for (const [name, path] of Object.entries(SOUND_FILES)) {
    const a = new Audio(path);
    a.preload = 'auto';
    _audioCache[name] = a;
  }
}

// Sofort vorladen sobald das Modul importiert wird
try { preload(); } catch { /* SSR oder kein Audio-Support */ }

/**
 * Spielt einen vorgeladenen Sound ab.
 * Nutzt cloneNode damit derselbe Sound parallel mehrfach abgespielt werden kann
 * (z.B. schnelles Abhaken mehrerer Artikel).
 */
function playSound(name, volume = 1.0) {
  if (!isSoundEnabled()) return;
  const base = _audioCache[name];
  if (!base) return;
  try {
    const clone = base.cloneNode();
    clone.volume = Math.max(0, Math.min(1, volume));
    clone.play().catch(() => {
      // Autoplay-Policy: Browser blockiert Play ohne User-Geste.
      // Da alle fb.*-Aufrufe in onClick-Handlern stehen, sollte das nie passieren.
    });
  } catch { /* still fail */ }
}

// ── Haptik (Vibration API) ────────────────────────────────────────────────────
// Funktioniert auf Android Chrome/TWA. iOS Safari ignoriert das stillschweigend.

export function haptic(pattern = 30) {
  if (!isHapticEnabled()) return;
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

const HAPTIC = {
  check:   () => haptic(40),           // kurzer Pulse — Abhaken
  soft:    () => haptic(20),           // sehr sanft — Hinzufügen
  success: () => haptic([50, 80, 50]), // Doppel-Pulse — Ziel erreicht
  error:   () => haptic([20, 30, 20, 30, 20]), // 3× kurz — Fehler
  neutral: () => haptic(15),           // kaum spürbar — Navigation/Status
};

// ── Öffentliche API ───────────────────────────────────────────────────────────
// Zuordnung laut Tabelle:
//
// Habit abhaken                                → erledigt.wav
// Letztes Habit (alle done)                   → ziel_erreicht.wav
// ToDo abhaken                                → click.mp3
// ToDo angelegt                               → click2.wav
// Alle ToDos erledigt                         → ziel_erreicht.wav
// Artikel abhaken                             → click2.wav
// Letzter Artikel (alle done)                 → ziel_erreicht2.wav
// Liste angelegt                              → erledigt.wav
// Artikel hinzugefügt                         → click2.wav
// Listen-Status weiterschalten                → swoosh.wav
// Workout als erledigt markieren              → ziel_erreicht2.wav
// Ruhetag eintragen                           → swoosh.wav
// Training abhaken (Plan-Tag)                 → ziel_erreicht.wav
// Speichern fehlgeschlagen / Netzwerkfehler   → negativ.wav
// Fixkosten abhaken                           → zahlung.wav
// Variable Kosten abhaken                     → zahlung.wav
// Sonstige Ausgaben abhaken                   → zahlung.wav
// Fix+Variable+Sonstige alle abgehakt         → fixkosten_alle.wav

export const fb = {

  // ── Gewohnheiten ──────────────────────────────────────────────────
  habitCheck: () => {
    HAPTIC.check();
    playSound('erledigt');
  },

  habitAllDone: () => {
    HAPTIC.success();
    playSound('ziel_erreicht');
  },

  // ── ToDo ──────────────────────────────────────────────────────────
  todoCheck: () => {
    HAPTIC.check();
    playSound('click');
  },

  todoCreate: () => {
    HAPTIC.soft();
    playSound('click2');
  },

  todoAllDone: () => {
    HAPTIC.success();
    playSound('ziel_erreicht');
  },

  // ── Einkauf ───────────────────────────────────────────────────────
  itemCheck: () => {
    HAPTIC.check();
    playSound('click2');
  },

  itemAllDone: () => {
    HAPTIC.success();
    playSound('ziel_erreicht2');
  },

  listCreate: () => {
    HAPTIC.soft();
    playSound('erledigt');
  },

  itemAdd: () => {
    HAPTIC.soft();
    playSound('click2');
  },

  listStatusCycle: () => {
    HAPTIC.neutral();
    playSound('swoosh', 0.7);
  },

  // ── Sport ─────────────────────────────────────────────────────────
  workoutDone: () => {
    HAPTIC.success();
    playSound('ziel_erreicht2');
  },

  restDay: () => {
    HAPTIC.neutral();
    playSound('swoosh', 0.7);
  },

  planDayCheck: () => {
    HAPTIC.check();
    playSound('ziel_erreicht');
  },

  // ── Finanzen ──────────────────────────────────────────────────────
  paymentCheck: () => {
    HAPTIC.check();
    playSound('zahlung');
  },

  paymentAllDone: () => {
    HAPTIC.success();
    playSound('fixkosten_alle');
  },

  // ── Fehler ────────────────────────────────────────────────────────
  error: () => {
    HAPTIC.error();
    playSound('negativ');
  },
};
