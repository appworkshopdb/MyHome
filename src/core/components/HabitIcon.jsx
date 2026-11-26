import Icon from './Icon';
import { habitIconName } from '../lib/habitIcons';

// Zeigt das Liniensymbol zur Emoji-Auswahl einer Gewohnheit, sonst das Emoji selbst.
export default function HabitIcon({ emoji, size = 22 }) {
  const name = habitIconName(emoji);
  return name ? <Icon name={name} size={size} /> : <span aria-hidden="true">{emoji}</span>;
}
