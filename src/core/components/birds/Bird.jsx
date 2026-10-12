import { useMemo } from 'react';
import { birdSvg } from './birdArt';

// <Bird species="robin|meise" stage={1..14} size={px} head animated />
// head = Kopf-/Brustausschnitt für kleine Anzeigen (Top-Bar, Avatar-Größen).
export default function Bird({ species, stage, size = 120, head = false, animated = true, className = '' }) {
  const html = useMemo(() => birdSvg({ species, stage, head }), [species, stage, head]);
  return (
    <span
      className={`nbird${animated ? '' : ' nbird--still'}${head ? ' nbird--head' : ''} ${className}`.trim()}
      style={{ width: size, height: head ? size : size * (275 / 240) }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
