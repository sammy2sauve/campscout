import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { useApp } from '../../context/AppContext.jsx'
import styles from './MapView.module.css'

// Atlanta center — covers SE US target region on load
const CENTER = [33.7490, -84.3880]
const ZOOM = 7

function BboxTracker({ onBboxChange }) {
  useMapEvents({
    moveend(e) {
      const b = e.target.getBounds()
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',')
      onBboxChange(bbox)
    },
  })
  return null
}

function MapRefSetter() {
  const map = useMap()
  const { mapRef } = useApp()
  useEffect(() => {
    mapRef.current = map
    // Fire initial bbox
  }, [map, mapRef])
  return null
}

function SearchCenterWatcher() {
  const map = useMap()
  const { searchCenter } = useApp()
  useEffect(() => {
    if (searchCenter) {
      map.flyTo([searchCenter.lat, searchCenter.lon], 10)
    }
  }, [searchCenter, map])
  return null
}

export function MapView({ campgrounds, onBboxChange }) {
  const { selectedId, setSelectedId } = useApp()

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={CENTER}
        zoom={ZOOM}
        className={styles.map}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <BboxTracker onBboxChange={onBboxChange} />
        <MapRefSetter />
        <SearchCenterWatcher />

        <MarkerClusterGroup chunkedLoading>
          {campgrounds.map((cg) => (
            <Marker
              key={cg.id}
              position={[cg.location.lat, cg.location.lon]}
              eventHandlers={{
                click: () => setSelectedId(cg.id),
              }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  )
}
