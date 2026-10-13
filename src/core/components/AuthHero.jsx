// core/components/AuthHero.jsx
// Dunkelblauer Kopfbereich der Anmelde-/Registrier-/Reset-Seiten: Wortmarke,
// Aussage, Untertext und die sechs Bereichs-Symbole. Styles: .lg-navy in
// styles/onboarding.css.

import { ModuleIcon } from './ModuleIcons';

const MODULES = ['hub', 'habits', 'finance', 'sport', 'nutrition', 'shopping'];

export default function AuthHero({ title, sub, compact = false }) {
  return (
    <div className="lg-navy">
      <span className="lg-wordmark">NESTUA</span>
      <h1>{title}</h1>
      <p>{sub}</p>
      {!compact && (
        <div className="lg-mods" aria-hidden="true">
          {MODULES.map((id) => <i key={id}><ModuleIcon id={id} size={22} /></i>)}
        </div>
      )}
    </div>
  );
}
