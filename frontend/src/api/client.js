const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

async function get(path, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== false && v !== '') {
      qs.set(k, v)
    }
  }
  const url = `${BASE}/api${path}${qs.toString() ? '?' + qs.toString() : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

export async function fetchRegions() {
  return get('/regions')
}

export async function fetchCampgrounds({
  bbox,
  state,
  region,
  has_electricity,
  has_showers,
  has_toilets,
  has_drinking_water,
  pets_allowed,
  wildlife_tags,
  terrain_tags,
  activity_tags,
  limit = 200,
  offset = 0,
} = {}) {
  return get('/campgrounds', {
    bbox,
    state,
    region,
    has_electricity: has_electricity || undefined,
    has_showers: has_showers || undefined,
    has_toilets: has_toilets || undefined,
    has_drinking_water: has_drinking_water || undefined,
    pets_allowed: pets_allowed || undefined,
    wildlife_tags: wildlife_tags?.length ? wildlife_tags.join(',') : undefined,
    terrain_tags: terrain_tags?.length ? terrain_tags.join(',') : undefined,
    activity_tags: activity_tags?.length ? activity_tags.join(',') : undefined,
    limit,
    offset,
  })
}

export async function fetchCampgroundDetail(id) {
  return get(`/campgrounds/${id}`)
}

export async function fetchWeather(id, days = 7) {
  return get(`/campgrounds/${id}/weather`, { days })
}

export async function fetchAlerts(id) {
  return get(`/campgrounds/${id}/alerts`)
}

export async function fetchAvailability(id, start, end) {
  // Both dates required — caller must guard against null
  const fmt = (d) => d.toISOString().slice(0, 10)
  return get(`/campgrounds/${id}/availability`, { start: fmt(start), end: fmt(end) })
}

// Nominatim — called directly (not proxied). 600ms debounce enforced by caller.
export async function geocodeLocation(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    countrycodes: 'us',
  })
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'User-Agent': 'CampScout/1.0 (portfolio project)' } }
  )
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)
  return res.json() // [{ lat, lon, display_name }]
}
