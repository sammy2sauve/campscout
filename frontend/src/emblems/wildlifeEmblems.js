/**
 * Wildlife emblem groups — 7 SVG icons + keyword → group mapping.
 * All icons are inline SVG strings; no external files needed.
 *
 * Accessibility: every icon is used with an aria-label or inside a <title>.
 * Color is NEVER the sole indicator — shape/icon always accompanies it.
 */

// ── Keyword → group mapping ────────────────────────────────────────────────

const KEYWORD_TO_GROUP = {
  // Bear
  bear: 'bear', 'black bear': 'bear', 'brown bear': 'bear',
  // Eagle / raptor
  hawk: 'eagle', eagle: 'eagle', 'bald eagle': 'eagle', osprey: 'eagle',
  // Alligator
  alligator: 'alligator', gator: 'alligator',
  // Deer / elk
  deer: 'deer', 'white-tailed deer': 'deer', elk: 'deer',
  // Snake
  snake: 'snake', rattlesnake: 'snake', copperhead: 'snake',
  cottonmouth: 'snake', 'water moccasin': 'snake',
  // Firefly
  firefly: 'firefly', 'lightning bug': 'firefly',
  // Owl
  owl: 'owl',
}

// All other wildlife → 'other' (small paw icon)

export const WILDLIFE_PRIORITY = [
  'alligator', 'bear', 'elk', 'eagle', 'owl', 'deer', 'snake', 'firefly', 'other',
]

/** Return the highest-priority wildlife group present in a tag list. */
export function primaryWildlifeGroup(tags) {
  if (!tags?.length) return null
  const groups = new Set(tags.map(t => KEYWORD_TO_GROUP[t.toLowerCase()] ?? 'other'))
  for (const g of WILDLIFE_PRIORITY) {
    if (groups.has(g)) return g
  }
  return null
}

// ── SVG icon strings ───────────────────────────────────────────────────────
// viewBox="0 0 24 24", designed to render at 16×16 or 20×20.
// fill="currentColor" so callers control color via CSS.

const ICONS = {
  bear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Bear paw: large pad + 4 toe pads -->
    <ellipse cx="12" cy="14" rx="6" ry="7"/>
    <circle cx="6"  cy="6"  r="2.5"/>
    <circle cx="11" cy="4.5" r="2.5"/>
    <circle cx="16.5" cy="5.5" r="2.5"/>
    <circle cx="20" cy="9"  r="2.5"/>
  </svg>`,

  eagle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Eagle in flight: wide wingspan silhouette -->
    <path d="M12 9 C8 6 2 7 1 10 C4 9 8 10 10 12 L12 11 L14 12 C16 10 20 9 23 10 C22 7 16 6 12 9Z"/>
    <ellipse cx="12" cy="13" rx="2.5" ry="4"/>
    <path d="M10 17 L12 22 L14 17Z"/>
  </svg>`,

  alligator: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Alligator side profile: long snout, bumpy back -->
    <path d="M1 14 L6 11 L10 10 L14 9 L18 10 L22 9 L22 12 L18 13 L14 14 L10 14 L6 15 L3 16Z"/>
    <path d="M18 9 L22 7 L23 9 L22 9Z"/>
    <circle cx="19" cy="10.5" r="0.8"/>
  </svg>`,

  deer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Antler silhouette -->
    <path d="M9 14 L8 10 L6 6 L4 3 M8 10 L6 8 M6 6 L8 5"/>
    <path d="M15 14 L16 10 L18 6 L20 3 M16 10 L18 8 M18 6 L16 5"/>
    <ellipse cx="12" cy="16" rx="4" ry="5"/>
    <circle cx="12" cy="13" r="2.5"/>
  </svg>`,

  snake: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Coiled snake -->
    <path d="M12 4 C18 4 21 8 20 12 C19 16 15 18 12 17 C9 16 7 14 8 11 C9 8 12 7 14 9 C16 11 14 14 12 13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="12" cy="4.5" rx="2" ry="1.5"/>
    <path d="M10.5 3 L9 1.5 M13.5 3 L15 1.5" stroke="currentColor" stroke-width="1" fill="none"/>
  </svg>`,

  firefly: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Firefly: body + glow rays -->
    <ellipse cx="12" cy="13" rx="3" ry="5"/>
    <circle cx="12" cy="7" r="2"/>
    <line x1="12" y1="2"  x2="12" y2="4"  stroke="currentColor" stroke-width="1.5"/>
    <line x1="17" y1="4"  x2="15" y2="6"  stroke="currentColor" stroke-width="1.5"/>
    <line x1="7"  y1="4"  x2="9"  y2="6"  stroke="currentColor" stroke-width="1.5"/>
    <ellipse cx="12" cy="16" rx="2" ry="2.5" opacity="0.6"/>
  </svg>`,

  owl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Owl face-on: round head, big eyes, beak -->
    <ellipse cx="12" cy="13" rx="7" ry="9"/>
    <circle cx="9"  cy="11" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="15" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="9"  cy="11" r="1.2"/>
    <circle cx="15" cy="11" r="1.2"/>
    <path d="M10.5 14 L12 16 L13.5 14Z"/>
    <path d="M6 5 L9 8 M18 5 L15 8" stroke="currentColor" stroke-width="1.5" fill="none"/>
  </svg>`,

  other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <!-- Generic paw (small wildlife) -->
    <ellipse cx="12" cy="15" rx="5" ry="6"/>
    <circle cx="7"  cy="8"  r="2"/>
    <circle cx="11" cy="6"  r="2"/>
    <circle cx="16" cy="7"  r="2"/>
    <circle cx="19" cy="11" r="2"/>
  </svg>`,
}

/** Return raw SVG string for a wildlife group, or null. */
export function getWildlifeIcon(group) {
  return ICONS[group] ?? null
}

/**
 * Return only the inner content of the SVG (strips <svg> wrapper).
 * Used when embedding wildlife icons inside a larger composite SVG marker.
 */
export function getWildlifeIconInner(group) {
  const svg = ICONS[group]
  if (!svg) return null
  return svg.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<!--[^>]*-->/g, '').trim()
}

/** Return all groups with their labels and SVG icons for the legend. */
export const WILDLIFE_LEGEND = [
  { group: 'bear',      label: 'Bear' },
  { group: 'eagle',     label: 'Raptor' },
  { group: 'alligator', label: 'Alligator' },
  { group: 'deer',      label: 'Deer / Elk' },
  { group: 'snake',     label: 'Snake' },
  { group: 'firefly',   label: 'Firefly' },
  { group: 'owl',       label: 'Owl' },
  { group: 'other',     label: 'Wildlife' },
].map(item => ({ ...item, svg: ICONS[item.group] }))
