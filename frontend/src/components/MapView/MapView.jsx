import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import {
  MapContainer, TileLayer, Marker, Tooltip,
  LayersControl, GeoJSON, useMapEvents, useMap,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useApp } from '../../context/AppContext.jsx'
import { primaryWildlifeGroup, getWildlifeIconInner } from '../../emblems/wildlifeEmblems.js'
import { primaryTerrainColor } from '../../emblems/terrainColors.js'
import { SE_FEATURES, FEATURE_ICONS } from '../../data/seFeatures.js'
import { FreshnessBadge } from './FreshnessBadge.jsx'
import { MapLegend } from './MapLegend.jsx'
import styles from './MapView.module.css'

// Default center (Atlanta) — overridden when a region is selected
const DEFAULT_CENTER = [33.7490, -84.3880]
const DEFAULT_ZOOM = 7

// ── Campground marker (single SVG — no overflow issues) ───────────────────

function makeCampgroundSVG(fill, terrainColor, wildlifeIconInner) {
  const ring = terrainColor
    ? `<circle cx="16" cy="18" r="17" fill="none" stroke="${terrainColor}" stroke-width="3.5" opacity="0.88"/>`
    : ''

  const badge = wildlifeIconInner
    ? `<circle cx="33" cy="-6" r="9" fill="#2c1f0e" stroke="#c8a870" stroke-width="1.4"/>
       <g transform="translate(33,-6) scale(0.58) translate(-12,-12)" fill="#e09050">${wildlifeIconInner}</g>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -14 44 52" width="44" height="52">
    ${ring}
    <polygon points="16,2 30,28 2,28" fill="${fill}" stroke="#2c1f0e" stroke-width="1.6" stroke-linejoin="round"/>
    <line x1="2" y1="28" x2="30" y2="28" stroke="#2c1f0e" stroke-width="2"/>
    <path d="M10,28 Q16,20 22,28" fill="rgba(44,31,14,0.72)"/>
    ${badge}
  </svg>`
}

function makeCampgroundIcon(cg, isSelected) {
  const fill = isSelected ? '#2e6b2e' : '#c4622d'
  const terrainColor = primaryTerrainColor(cg.terrain_tags)
  const wildlifeGroup = primaryWildlifeGroup(cg.wildlife_tags)
  const wildlifeInner = wildlifeGroup ? getWildlifeIconInner(wildlifeGroup) : null

  return L.divIcon({
    html: makeCampgroundSVG(fill, terrainColor, wildlifeInner),
    className: 'campground-marker',
    iconSize: [44, 52],
    iconAnchor: [22, 48],
    popupAnchor: [0, -48],
  })
}

// ── Feature marker (national forest / park) ───────────────────────────────

function makeFeatureIcon(type) {
  const emoji = FEATURE_ICONS[type] ?? '📍'
  const bg = type === 'np' ? '#4a6e3a' : type === 'nf' ? '#2e6b2e' : '#8b5e3c'
  return L.divIcon({
    html: `<div style="
      background:${bg};
      color:#e8dfc8;
      border:2px solid #2c1f0e;
      border-radius:50%;
      width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;
      box-shadow:0 1px 4px rgba(0,0,0,0.45);
    ">${emoji}</div>`,
    className: 'feature-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

// ── Feature layer ─────────────────────────────────────────────────────────

function FeatureLayer({ minZoom = 7 }) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  useMapEvents({ zoomend: (e) => setZoom(e.target.getZoom()) })
  if (zoom < minZoom) return null

  return SE_FEATURES.map((f) => (
    <Marker
      key={f.id}
      position={[f.lat, f.lon]}
      icon={makeFeatureIcon(f.type)}
    >
      <Tooltip permanent={false} direction="top" offset={[0, -18]}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</span>
      </Tooltip>
    </Marker>
  ))
}

// ── State name → 2-letter abbreviation ────────────────────────────────────

const STATE_ABBR = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
  'Puerto Rico': 'PR',
}

// ── Region bbox mask ───────────────────────────────────────────────────────
// Grey everything outside the region's bounding box using a world-minus-bbox
// polygon. This guarantees markers (which are all inside the bbox) are never
// rendered on top of grey, regardless of state-boundary precision.

function RegionBboxMask({ regionData }) {
  if (!regionData?.bbox) return null
  const { min_lat, min_lon, max_lat, max_lon } = regionData.bbox

  const worldWithHole = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        // Outer: world envelope
        [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
        // Inner hole: region bbox (counter-clockwise for GeoJSON hole)
        [[min_lon, min_lat], [min_lon, max_lat], [max_lon, max_lat], [max_lon, min_lat], [min_lon, min_lat]],
      ],
    },
  }

  return (
    <GeoJSON
      key={regionData.id + '-mask'}
      data={worldWithHole}
      style={{ fillColor: '#0e0e0e', fillOpacity: 0.65, stroke: false, interactive: false }}
    />
  )
}

// ── State glow overlay ─────────────────────────────────────────────────────
// Amber border glow on region states only — no grey fill (handled by bbox mask above).

function StateGlowOverlay({ regionData }) {
  const [geojson, setGeojson] = useState(null)

  useEffect(() => {
    fetch('/us-states.geojson')
      .then((r) => r.json())
      .then(setGeojson)
      .catch(() => {})
  }, [])

  if (!geojson || !regionData) return null

  const regionStates = new Set(regionData.states)

  function stateStyle(feature) {
    const abbr = STATE_ABBR[feature.properties.NAME]
    if (regionStates.has(abbr)) {
      return {
        fillOpacity: 0,
        color: '#c8a870',
        weight: 2,
        opacity: 0.9,
        className: 'region-state-glow',
        interactive: false,
      }
    }
    return { fillOpacity: 0, stroke: false, interactive: false }
  }

  return <GeoJSON key={regionData.id + '-glow'} data={geojson} style={stateStyle} />
}

// ── Region bounds fitter ───────────────────────────────────────────────────

function RegionBoundsFitter({ regionData }) {
  const map = useMap()

  useEffect(() => {
    if (!regionData?.bbox) return
    const { min_lat, min_lon, max_lat, max_lon } = regionData.bbox
    map.fitBounds([[min_lat, min_lon], [max_lat, max_lon]], { padding: [20, 20] })
  }, [map, regionData])

  return null
}

// ── Map helpers ───────────────────────────────────────────────────────────

function BboxTracker({ onBboxChange }) {
  const map = useMap()
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    const b = map.getBounds()
    onBboxChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','))
  }, [map, onBboxChange])

  useMapEvents({
    moveend(e) {
      const b = e.target.getBounds()
      onBboxChange([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','))
    },
  })
  return null
}

function MapRefSetter() {
  const map = useMap()
  const { mapRef } = useApp()
  useEffect(() => { mapRef.current = map }, [map, mapRef])
  return null
}

function SearchCenterWatcher() {
  const map = useMap()
  const { searchCenter } = useApp()
  useEffect(() => {
    if (searchCenter) map.flyTo([searchCenter.lat, searchCenter.lon], 10)
  }, [searchCenter, map])
  return null
}

// ── Main component ────────────────────────────────────────────────────────

export function MapView({ campgrounds, dataAsOf, onBboxChange, regionData }) {
  const { selectedId, setSelectedId } = useApp()

  const validCampgrounds = campgrounds.filter(
    (cg) => cg.location?.lat != null && cg.location?.lon != null
  )

  // Derive maxBounds from region if available
  const maxBounds = regionData?.bbox
    ? [
        [regionData.bbox.min_lat - 2, regionData.bbox.min_lon - 2],
        [regionData.bbox.max_lat + 2, regionData.bbox.max_lon + 2],
      ]
    : undefined

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className={styles.map}
        zoomControl={true}
        maxBounds={maxBounds}
        maxBoundsViscosity={0.85}
      >
        {/* Tile layers — OpenTopoMap default shows terrain, rivers, forests, roads */}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Outdoor (Topo)">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
              maxZoom={17}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Street">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <BboxTracker onBboxChange={onBboxChange} />
        <MapRefSetter />
        <SearchCenterWatcher />
        <RegionBoundsFitter regionData={regionData} />

        {/* Bbox-based grey mask (no state precision issues) + amber state glow */}
        <RegionBboxMask regionData={regionData} />
        <StateGlowOverlay regionData={regionData} />

        {/* National forests + parks feature markers */}
        <FeatureLayer minZoom={6} />

        {/* Campground cluster + tent markers */}
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={(cluster) => L.divIcon({
            html: `<div class="${styles.cluster}">${cluster.getChildCount()}</div>`,
            className: '',
            iconSize: [36, 36],
          })}
        >
          {validCampgrounds.map((cg) => (
            <Marker
              key={cg.id}
              position={[cg.location.lat, cg.location.lon]}
              icon={makeCampgroundIcon(cg, cg.id === selectedId)}
              eventHandlers={{ click: () => setSelectedId(cg.id) }}
              title={cg.name}
            >
              <Tooltip direction="top" offset={[0, -50]} opacity={0.95}>
                {cg.name}
              </Tooltip>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      <MapLegend />
      <FreshnessBadge dataAsOf={dataAsOf} />
    </div>
  )
}
