/**
 * Activity emblem system — 6 activity types, each with a unique SVG icon,
 * label, and keyword list.
 *
 * Activities are things you DO at a campground (fishing, hunting, hiking, etc.)
 * and are stored separately from landscape tags (geographic features).
 *
 * Future: filter by current hunting season, show fishing/hunting areas on map.
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
    label: 'Primitive',
    keywords: ['primitive'],
  },
]

// ── SVG icon strings ──────────────────────────────────────────────────────
// viewBox="0 0 24 24", fill="currentColor"

const ICONS = {
  fishing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Fishing rod: diagonal from bottom-left grip to top-right tip -->
    <path d="M2 22 L2 20 L18 2 L20 4 Z"/>
    <!-- Reel: ring on the rod -->
    <ellipse cx="9" cy="14" rx="3" ry="3" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <!-- Fishing line from tip + hook -->
    <path d="M20 4 L23 9 L23 19 Q23 23 19 23 Q15 23 15 19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  hunting: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Bow: curved arc on the left -->
    <path d="M7 2 Q1 12 7 22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <!-- Bowstring: straight tension line -->
    <line x1="7" y1="2" x2="7" y2="22" stroke="currentColor" stroke-width="1.2"/>
    <!-- Arrow shaft -->
    <line x1="5" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <!-- Arrowhead -->
    <path d="M17 8 L23 12 L17 16 Z"/>
    <!-- Fletching -->
    <path d="M5 12 L8 9 M5 12 L8 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  hiking: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Head -->
    <circle cx="14" cy="3.5" r="2.5"/>
    <!-- Body + legs -->
    <path d="M14 6 L13.5 13 L10 20 L12 20 L14.5 15 L17 20 L19 20 L16 13 L16 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Arms: one reaching toward pole -->
    <path d="M10 9 L13.5 11 L17 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <!-- Trekking pole -->
    <line x1="17" y1="7" x2="21" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  swimming: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Head -->
    <circle cx="19" cy="6" r="2.5"/>
    <!-- Arm stroke -->
    <path d="M5 10 Q9 7 13 9 L19 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Water waves (two rows) -->
    <path d="M1 16 Q4 13 7 16 Q10 19 13 16 Q16 13 19 16 Q21 17.5 23 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M1 20 Q4 17 7 20 Q10 23 13 20 Q16 17 19 20 Q21 21.5 23 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,

  boating: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Canoe hull -->
    <path d="M2 14 Q5 10 12 9 Q19 10 22 14 Q17 17 7 17 Z"/>
    <!-- Paddle: vertical shaft + blade -->
    <line x1="12" y1="4" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="12" cy="3" rx="3.5" ry="2"/>
    <!-- Water line -->
    <path d="M1 20 Q5 17 9 20 Q13 23 17 20 Q20 18 23 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  primitive: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Campfire base logs -->
    <rect x="3" y="18" width="18" height="3" rx="1.5"/>
    <!-- Log supports -->
    <line x1="7" y1="18" x2="12" y2="11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="17" y1="18" x2="12" y2="11" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Flames: center + sides -->
    <path d="M12 11 Q9 7 11 3 Q13.5 6.5 12 11"/>
    <path d="M10 14 Q7 11 9 7 Q10.5 10 10 14"/>
    <path d="M14 14 Q17 11 15 7 Q13.5 10 14 14"/>
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

/** Return raw SVG string for an activity id, or null. */
export function getActivityIcon(idOrKeyword) {
  const id = ICONS[idOrKeyword] ? idOrKeyword : _kwMap[idOrKeyword?.toLowerCase()]
  return ICONS[id] ?? null
}

/** All activities with their label and SVG for legend / filter. */
export const ACTIVITY_LEGEND = ACTIVITY_TYPES.map(a => ({
  ...a,
  svg: ICONS[a.id],
}))
