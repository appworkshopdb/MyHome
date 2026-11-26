import Icon from './Icon';

// Liniensymbol je Mahlzeit-Typ (statt Emoji, Redesign 26.11.2026). Nur Anzeige: die Schlüssel bleiben.
const NAME = { fruehstueck: 'coffee', mittag: 'food', abend: 'rest', snack: 'apple', all: 'food' };

export default function MealIcon({ type, size = 20 }) {
  return <Icon name={NAME[type] || 'food'} size={size} />;
}
