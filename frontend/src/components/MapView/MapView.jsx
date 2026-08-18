import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import {
  MapContainer, TileLayer, Marker, Tooltip,
  LayersControl, useMapEvents, useMap,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useApp } from '../../context/AppContext.jsx'
import { primaryWildlifeGroup, getWildlifeIconInner } from '../../emblems/wildlifeEmblems.js'
import { primaryTerrainColor } from '../../emblems/terrainColors.js'
import { SE_FEATURES, FEATURE_ICONS } from '../../data/seFeatures.js'
import { FreshnessBadge } from './FreshnessBadge.jsx'
import { MapLegend } from './MapLegend.jsx'
import styles from './MapView.module.css'

// Atlanta center — covers SE US target region on load
const CENTER = [33.7490, -84.3880]
const ZOOM = 7

// ── Campground marker (single SVG — no overflow issues) ───────────────────

/**
 * Build a self-contained SVG tent marker.
 * Everything lives inside one SVG viewBox so the terrain ring and
 * wildlife badge never clip against the Leaflet icon container.
 *
 * viewBox "-6 -14 44 52" gives room for:
 *   - terrain ring (circle r=17 centered at 16,16)
 *   - badge circle (center 33, -6, r=9) at top-right
 */
function makeCampgroundSVG(fill, terrainColor, wildlifeIconInner) {
  const ring = terrainColor
    ? `<circle cx="16" cy="18" r="17" fill="none" stroke="${terrainColor}" stroke-width="3.5" opacity="0.88"/>`
    : ''

  // Badge: circle at top-right, wildlife icon inside scaled to fit
  // Icon (24×24 original) scaled 0.58× and centered at badge center (33,-6)
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
  const [zoom, setZoom] = useState(ZOOM)
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

export function MapView({ campgrounds, dataAsOf, onBboxChange }) {
  const { selectedId, setSelectedId } = useApp()

  const validCampgrounds = campgrounds.filter(
    (cg) => cg.location?.lat != null && cg.location?.lon != null
  )

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        className={styles.map}
        zoomControl={true}
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
