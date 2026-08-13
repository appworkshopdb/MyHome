import { IconChevronRight } from './Icons';

// Button bleibt immer aktiv (kein Ausgrauen bis vollständig) — der
// Hinweis selbst übernimmt die Führung, statt den Nutzer zu blockieren.
export default function RequiredDataBanner({ title, missing, ctaLabel = 'Jetzt ausfüllen', onFix }) {
  if (!missing || missing.length === 0) return null;
  return (
    <div className="required-banner">
      <div className="required-banner-text">
        <div className="required-banner-title">{title}</div>
        <div className="required-banner-fields">Fehlt: {missing.map((m) => m.label).join(', ')}</div>
      </div>
      <button className="required-banner-cta" onClick={onFix}>
        {ctaLabel} <IconChevronRight />
      </button>
    </div>
  );
}
