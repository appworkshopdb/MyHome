// Emoji einer Gewohnheit -> Liniensymbol aus Icon.jsx (Redesign, Entscheidung vom 26.11.2026).
// Nur für die Anzeige: gespeichert bleibt das Emoji (Daten ändern sich nicht).
// Unbekannte Emoji (eigene Auswahl) werden weiter als Emoji gezeigt.
const MAP = {
  '🏃': 'walk', '🚶': 'walk', '💪': 'dumbbell', '🧘': 'person', '🪜': 'stairs',
  '💧': 'drop', '🥦': 'leaf', '🍎': 'apple', '🚫': 'ban', '🍳': 'pan',
  '😴': 'rest', '📵': 'phoneOff', '⏰': 'due', '☕': 'coffee',
  '🧠': 'brain', '🌬': 'wind', '🙏': 'heart', '📓': 'note', '🌿': 'leaf',
  '📋': 'clipcheck', '📱': 'phone', '🎯': 'target', '✅': 'habits', '📬': 'mail',
  '📚': 'book', '🛏': 'bed', '🌱': 'leaf', '⭐': 'star', '🔥': 'streak',
  '💎': 'diamond', '🎵': 'music', '🌅': 'sun', '🌞': 'sun', '🏆': 'trophy',
  '⚡': 'bolt', '💊': 'pill', '🏠': 'home',
};
export const habitIconName = (emoji) => MAP[String(emoji || '').replace(/\uFE0F/g, '')] || null;
