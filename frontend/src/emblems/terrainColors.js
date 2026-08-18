/**
 * Terrain color system — 9 terrain types, each with a keyword list,
 * a color, and a label.
 *
 * Accessibility: terrain color always appears paired with a text label
 * (dot + text in legend/pills, ring + title on markers).
 * Colors are chosen for ≥3:1 contrast against the parchment background (#e8dfc8).
 */

export const TERRAIN_TYPES = [
  {
    id: 'waterfall',
    label: 'Waterfall',
    color: '#3a7abf',  // Steel blue — verified ≥3:1 on #e8dfc8
    keywords: ['waterfall', 'falls'],
  },
  {
    id: 'cave',
    label: 'Cave',
    color: '#4a3a62',  // Deep purple
    keywords: ['cave', 'cavern'],
  },
  {
    id: 'hot spring',
    label: 'Hot Spring',
    color: '#c04010',  // Hot red-orange
    keywords: ['hot spring', 'spring'],
  },
  {
    id: 'beach',
    label: 'Beach',
    color: '#a07820',  // Sandy gold (darkened for contrast)
    keywords: ['beach', 'sandy beach'],
  },
  {
    id: 'swamp',
    label: 'Swamp / Wetland',
    color: '#4a6e3a',  // Murky green
    keywords: ['swamp', 'wetland', 'marsh'],
  },
  {
    id: 'water',
    label: 'Lake / River',
    color: '#2060a0',  // Deep steel blue
    keywords: ['lake', 'pond', 'river', 'creek', 'stream', 'waterfront', 'swimming', 'fishing', 'boating'],
  },
  {
    id: 'mountains',
    label: 'Mountains',
    color: '#6a4a28',  // Earth brown
    keywords: ['mountain', 'ridge', 'peak', 'summit', 'valley', 'canyon', 'gorge', 'ravine'],
  },
  {
    id: 'forest',
    label: 'Forest',
    color: '#2e6b2e',  // Deep green (matches primary)
    keywords: ['forest', 'woodland', 'old growth', 'trail', 'hiking', 'shaded', 'walk-in'],
  },
  {
    id: 'meadow',
    label: 'Meadow',
    color: '#7a7a20',  // Olive gold
    keywords: ['meadow', 'prairie', 'field'],
  },
]

// Priority order for multi-terrain campgrounds (most distinctive first)
export const TERRAIN_PRIORITY = [
  'waterfall', 'cave', 'hot spring', 'beach', 'swamp',
  'water', 'mountains', 'forest', 'meadow',
]

// Build lookup maps
const _colorMap = {}
const _idMap = {}
for (const t of TERRAIN_TYPES) {
  _colorMap[t.id] = t.color
  _idMap[t.id] = t
  for (const kw of t.keywords) {
    _colorMap[kw] = t.color
    _idMap[kw] = t
  }
}

/** Return terrain hex color for a single tag string, or null. */
export function getTerrainColor(tag) {
  return _colorMap[tag?.toLowerCase()] ?? null
}

/** Return the terrain type object for a tag string, or null. */
export function getTerrainType(tag) {
  return _idMap[tag?.toLowerCase()] ?? null
}

/** Return the highest-priority terrain color from a tag list. */
export function primaryTerrainColor(tags) {
  if (!tags?.length) return null
  // Collect all terrain IDs present
  const ids = new Set()
  for (const tag of tags) {
    const t = getTerrainType(tag)
    if (t) ids.add(t.id)
  }
  for (const id of TERRAIN_PRIORITY) {
    if (ids.has(id)) return _colorMap[id]
  }
  return null
}

// ── Landscape SVG icons ────────────────────────────────────────────────────
// viewBox="0 0 24 24", fill="currentColor" — callers control color via CSS.

const LANDSCAPE_ICONS = {
  waterfall: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 2 C7 5 5 9 5 15 L5 18 L7 18 L7 15 C7 9 9 5 9 2Z"/>
    <path d="M15 2 C15 5 13 9 13 15 L13 18 L15 18 L15 15 C15 9 17 5 17 2Z"/>
    <path d="M3 19 Q7 16 12 19 Q17 16 21 19" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  cave: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M1 22 L1 11 Q1 2 12 2 Q23 2 23 11 L23 22 L18 22 L18 13 Q18 7 12 7 Q6 7 6 13 L6 22 Z"/>
  </svg>`,

  'hot spring': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <ellipse cx="12" cy="20" rx="9" ry="3"/>
    <path d="M8 15 Q6 11 8 7 Q10 3 8 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 15 Q10 11 12 7 Q14 3 12 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M16 15 Q14 11 16 7 Q18 3 16 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  beach: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="18" cy="5" r="3"/>
    <rect x="1" y="14" width="22" height="2" rx="1"/>
    <path d="M1 19 Q5 16 9 19 Q13 22 17 19 Q20 17 23 19" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  swamp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M1 20 Q6 18 12 20 Q18 18 23 20 L23 23 L1 23Z"/>
    <rect x="6.5" y="10" width="2" height="10" rx="1"/>
    <ellipse cx="7.5" cy="8.5" rx="2" ry="4"/>
    <rect x="14.5" y="8" width="2" height="12" rx="1"/>
    <ellipse cx="15.5" cy="6.5" rx="2" ry="4"/>
    <rect x="10.5" y="12" width="2" height="8" rx="1"/>
    <ellipse cx="11.5" cy="10.5" rx="1.5" ry="3"/>
  </svg>`,

  water: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M1 7 Q5 4 9 7 Q13 10 17 7 Q20 5 23 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M1 13 Q5 10 9 13 Q13 16 17 13 Q20 11 23 13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M1 19 Q5 16 9 19 Q13 22 17 19 Q20 17 23 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  mountains: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M1 22 L8 7 L12 14 L15 5 L23 22Z"/>
    <path d="M15 5 L12.8 9.5 L17.2 9.5Z" opacity="0.4"/>
  </svg>`,

  forest: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1 L20 12 L16 12 L20.5 17.5 L15.5 17.5 L18.5 22 L5.5 22 L8.5 17.5 L3.5 17.5 L8 12 L4 12 Z"/>
  </svg>`,

  meadow: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M1 22 Q5 16 9 14 Q13 12 17 14 Q21 16 23 22Z"/>
    <path d="M7 14 Q6.5 10 7.5 7 Q8.5 10 9 14"/>
    <path d="M14 14 Q13.5 10 14.5 7 Q15.5 10 16 14"/>
    <circle cx="8" cy="6" r="2"/>
    <circle cx="15" cy="6" r="2"/>
  </svg>`,
}

// Build icon lookup by terrain id
const _iconMap = {}
for (const t of TERRAIN_TYPES) {
  if (LANDSCAPE_ICONS[t.id]) {
    _iconMap[t.id] = LANDSCAPE_ICONS[t.id]
    for (const kw of t.keywords) _iconMap[kw] = LANDSCAPE_ICONS[t.id]
  }
}

/** Return raw SVG string for a terrain tag, or null. */
export function getTerrainIcon(tag) {
  return _iconMap[tag?.toLowerCase()] ?? null
}

/**
 * Return only the inner SVG content (strips <svg> wrapper).
 * Used when embedding landscape icons inside a larger composite SVG.
 */
export function getTerrainIconInner(tag) {
  const svg = getTerrainIcon(tag)
  if (!svg) return null
  return svg.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<!--[^>]*-->/g, '').trim()
}

/** All terrain types with their label, color, and SVG for the legend. */
export const TERRAIN_LEGEND = TERRAIN_TYPES.map(t => ({
  ...t,
  svg: LANDSCAPE_ICONS[t.id] ?? null,
}))
