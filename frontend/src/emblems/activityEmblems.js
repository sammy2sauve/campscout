/**
 * Activity emblem system — 6 activity types, each with a unique SVG icon,
 * label, and keyword list.
 *
 * Icons are designed for clarity at 18px — bold, simple silhouettes.
 */

export const ACTIVITY_TYPES = [
  {
    id: 'fishing',
    label: 'Fishing',
    keywords: ['fishing'],
  },
  {
    id: 'hunting',
    label: 'Hunting',
    keywords: ['hunting', 'hunt'],
  },
  {
    id: 'hiking',
    label: 'Hiking',
    keywords: ['hiking', 'trail', 'walk-in', 'walk in'],
  },
  {
    id: 'swimming',
    label: 'Swimming',
    keywords: ['swimming', 'swim'],
  },
  {
    id: 'boating',
    label: 'Boating',
    keywords: ['boating', 'boat ramp', 'marina'],
  },
  {
    id: 'primitive',
    label: 'Primitive Camping',
    keywords: ['primitive'],
  },
]

// ── SVG icon strings ──────────────────────────────────────────────────────
// viewBox="0 0 24 24", fill="currentColor", designed for 18×18 display.
// Simple bold silhouettes — recognizable without reading a label.

const ICONS = {

  // Fish silhouette: body + forked tail + eye highlight
  fishing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M14 5 Q22 5 23 12 Q22 19 14 19 Q9 19 7 15 L1 18 L5 12 L1 6 L7 9 Q9 5 14 5Z"/>
    <circle cx="18.5" cy="10.5" r="1.8" style="fill:var(--color-panel,#dfd5b8)"/>
    <circle cx="19" cy="11" r="0.9"/>
  </svg>`,

  // Rifle scope / crosshair — universal hunting symbol
  hunting: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/>
    <circle cx="12" cy="12" r="2.5"/>
    <line x1="1"    y1="12" x2="7.5"  y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16.5" y1="12" x2="23"   y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="12"   y1="1"  x2="12"   y2="7.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="12"   y1="16.5" x2="12" y2="23"  stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  // Stick-figure hiker with trekking pole
  hiking: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="15" cy="3" r="2.5"/>
    <line x1="15" y1="5.5" x2="15" y2="13"  stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="10" y1="9"   x2="20" y2="9"   stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
    <line x1="15" y1="13"  x2="11" y2="22"  stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="15" y1="13"  x2="19" y2="22"  stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="20" y1="9"   x2="22.5" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  // Side-view swimmer: horizontal body, reaching arm, kick, water line
  swimming: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="20" cy="7" r="2.5"/>
    <path d="M5 10 L18 9" fill="none" stroke="currentColor" stroke-width="3"   stroke-linecap="round"/>
    <path d="M17 8 L7 6"  fill="none" stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
    <path d="M7 10 L5 15" fill="none" stroke="currentColor" stroke-width="2"   stroke-linecap="round"/>
    <path d="M9 10 L11 15" fill="none" stroke="currentColor" stroke-width="2"  stroke-linecap="round"/>
    <path d="M1 18 Q5 15 9 18 Q13 21 17 18 Q20 16 23 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  // Sailboat: mast + two sails + curved hull
  boating: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <line x1="12" y1="2" x2="12" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M12 3 L12 17 L3 17Z"/>
    <path d="M12 7 L12 17 L20 17Z"/>
    <path d="M2 18 Q12 23 22 18 L20 17 L4 17Z"/>
  </svg>`,

  // A-frame tent silhouette
  primitive: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2 22 L12 4 L22 22Z"/>
    <path d="M9.5 22 Q12 16 14.5 22" fill="none" stroke="var(--color-panel,#dfd5b8)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="1" y1="22" x2="23" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
}

// Build keyword → activity id lookup
const _kwMap = {}
for (const a of ACTIVITY_TYPES) {
  for (const kw of a.keywords) _kwMap[kw.toLowerCase()] = a.id
}

/** Return the activity id for a raw keyword tag, or null. */
export function getActivityId(tag) {
  return _kwMap[tag?.toLowerCase()] ?? null
}

/** Return raw SVG string for an activity id or keyword, or null. */
export function getActivityIcon(idOrKeyword) {
  const id = ICONS[idOrKeyword] ? idOrKeyword : _kwMap[idOrKeyword?.toLowerCase()]
  return ICONS[id] ?? null
}

/** All activities with their label and SVG for legend / filter. */
export const ACTIVITY_LEGEND = ACTIVITY_TYPES.map(a => ({
  ...a,
  svg: ICONS[a.id],
}))
