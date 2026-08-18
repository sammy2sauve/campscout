/**
 * Static geographic features for SE US — national forests and national parks.
 * Coordinates are centroids; these are stable geographic data that don't change.
 *
 * Sources:
 *  - USFS: https://apps.fs.usda.gov/arcgis/rest/services/EDW/EDW_ForestSystemBoundaries_01/
 *  - NPS:  https://www.nps.gov/subjects/maps/index.htm
 *
 * type: 'nf' = National Forest / 'np' = National Park / 'nr' = National Recreation Area
 */
export const SE_FEATURES = [
  // ── Georgia ─────────────────────────────────────────────────────────────
  { id: 'chattahoochee-oconee', name: 'Chattahoochee-Oconee NF', type: 'nf', lat: 34.75, lon: -83.85 },

  // ── Tennessee ────────────────────────────────────────────────────────────
  { id: 'cherokee-nf', name: 'Cherokee NF', type: 'nf', lat: 36.10, lon: -84.45 },
  { id: 'gsm-np', name: 'Great Smoky Mountains NP', type: 'np', lat: 35.61, lon: -83.53 },

  // ── North Carolina ───────────────────────────────────────────────────────
  { id: 'pisgah-nf', name: 'Pisgah NF', type: 'nf', lat: 35.43, lon: -82.70 },
  { id: 'nantahala-nf', name: 'Nantahala NF', type: 'nf', lat: 35.23, lon: -83.62 },
  { id: 'croatan-nf', name: 'Croatan NF', type: 'nf', lat: 34.93, lon: -77.01 },
  { id: 'uwharrie-nf', name: 'Uwharrie NF', type: 'nf', lat: 35.41, lon: -79.98 },
  { id: 'blue-ridge-pkwy', name: 'Blue Ridge Parkway', type: 'nr', lat: 35.80, lon: -82.23 },

  // ── South Carolina ───────────────────────────────────────────────────────
  { id: 'francis-marion-nf', name: 'Francis Marion NF', type: 'nf', lat: 33.22, lon: -79.69 },
  { id: 'sumter-nf', name: 'Sumter NF', type: 'nf', lat: 34.40, lon: -81.83 },
  { id: 'congaree-np', name: 'Congaree NP', type: 'np', lat: 33.80, lon: -80.84 },
  { id: 'kings-mountain-nr', name: 'Kings Mountain NMil', type: 'nr', lat: 35.13, lon: -81.38 },

  // ── Alabama ──────────────────────────────────────────────────────────────
  { id: 'talladega-nf', name: 'Talladega NF', type: 'nf', lat: 33.43, lon: -86.10 },
  { id: 'conecuh-nf', name: 'Conecuh NF', type: 'nf', lat: 31.38, lon: -86.63 },
  { id: 'bankhead-nf', name: 'Bankhead NF', type: 'nf', lat: 34.30, lon: -87.42 },
  { id: 'tuskegee-nf', name: 'Tuskegee NF', type: 'nf', lat: 32.48, lon: -85.72 },

  // ── Virginia ─────────────────────────────────────────────────────────────
  { id: 'jefferson-nf', name: 'Jefferson NF', type: 'nf', lat: 37.25, lon: -80.42 },
  { id: 'george-washington-nf', name: 'George Washington NF', type: 'nf', lat: 38.35, lon: -79.35 },
  { id: 'shenandoah-np', name: 'Shenandoah NP', type: 'np', lat: 38.53, lon: -78.35 },

  // ── West Virginia ────────────────────────────────────────────────────────
  { id: 'monongahela-nf', name: 'Monongahela NF', type: 'nf', lat: 38.52, lon: -80.03 },
  { id: 'new-river-gorge', name: 'New River Gorge NP', type: 'np', lat: 37.87, lon: -80.98 },

  // ── Kentucky ─────────────────────────────────────────────────────────────
  { id: 'daniel-boone-nf', name: 'Daniel Boone NF', type: 'nf', lat: 37.58, lon: -84.00 },
  { id: 'mammoth-cave-np', name: 'Mammoth Cave NP', type: 'np', lat: 37.19, lon: -86.10 },

  // ── Mississippi ──────────────────────────────────────────────────────────
  { id: 'bienville-nf', name: 'Bienville NF', type: 'nf', lat: 32.11, lon: -89.36 },
  { id: 'homochitto-nf', name: 'Homochitto NF', type: 'nf', lat: 31.40, lon: -90.95 },
]

export const FEATURE_ICONS = {
  nf: '🌲',  // National Forest
  np: '🏔',  // National Park
  nr: '🏞',  // National Recreation Area / Monument
}

export const FEATURE_LABELS = {
  nf: 'National Forest',
  np: 'National Park',
  nr: 'Natl Recreation Area',
}
