/**
 * Hand-drawn line-art plates for empty states. Single-stroke,
 * --color-ink-muted, no fills. Decorative; consumers wrap them with
 * aria-hidden in the empty-state container so the SR reads only the
 * surrounding copy.
 *
 * Designed to feel deliberately uneven — the roughness is the point.
 * The SVGs use `vector-effect="non-scaling-stroke"` so the line weight
 * stays even at any size.
 */

export function FoldedMapArt() {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Paper map, folded in thirds, with a circled spot and a dashed
          trail wandering off the bottom edge. */}
      <path d="M14 22 L48 14 L82 24 L82 76 L48 84 L14 74 Z" />
      <path d="M48 14 L48 84" />
      <path d="M30 18 L32 80" />
      <path d="M68 18 L66 80" />
      <circle cx="56" cy="44" r="5" />
      <path d="M56 50 C 58 60, 50 66, 56 78" strokeDasharray="3 3" />
    </svg>
  );
}

export function TramArt() {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Helsinki tram, three-quarter front. Five strokes: body
          outline, roof curve, window strip, door, pantograph. */}
      <path d="M16 76 L16 30 Q16 22 26 22 L72 22 Q82 22 82 30 L82 76" />
      <path d="M16 30 Q40 26 82 30" />
      <path d="M22 38 L76 38 L76 56 L22 56 Z" />
      <path d="M48 56 L48 76" />
      <path d="M44 22 L52 14" />
      <circle cx="28" cy="80" r="4" />
      <circle cx="70" cy="80" r="4" />
    </svg>
  );
}

export function SatelliteArt() {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Satellite with one panel cracked, plus a small speech-bubble
          question mark. */}
      <rect x="36" y="38" width="24" height="22" rx="2" />
      <path d="M48 38 L48 30 L44 26" />
      <path d="M16 44 L36 44 L36 54 L16 54 Z" />
      <path d="M22 44 L22 54 M28 44 L28 54" />
      <path d="M60 44 L80 44 L80 54 L60 54 Z" />
      <path d="M70 44 L66 54 M74 44 L70 54" />
      <path d="M64 60 L64 72 L76 72 Q80 72 80 76 L80 80 L70 78 L66 84" />
      <path d="M70 64 Q70 60 73 60 Q76 60 76 64 Q76 66 73 67 L73 70" />
      <circle cx="73" cy="73" r="0.8" fill="currentColor" />
    </svg>
  );
}
