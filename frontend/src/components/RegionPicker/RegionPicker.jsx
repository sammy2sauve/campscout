import { useEffect, useState } from 'react'
import { fetchRegions } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import styles from './RegionPicker.module.css'

// SVG map outline icons per region (minimal, decorative)
const REGION_ICONS = {
  southeast:   '🌿',
  northeast:   '🍂',
  great_lakes: '🌊',
  plains:      '🌾',
  mountain:    '⛰️',
  pacific_west:'🌲',
}

export function RegionPicker() {
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const { setSelectedRegion } = useApp()

  useEffect(() => {
    fetchRegions()
      .then(setRegions)
      .catch((err) => console.error('fetchRegions failed:', err))
      .finally(() => setLoading(false))
  }, [])

  function handleSelect(region) {
    setSelectedRegion(region.id)
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.container}>
        <h1 className={styles.title}>CampScout</h1>
        <p className={styles.subtitle}>Choose a region to explore federal campgrounds</p>

        {loading ? (
          <div className={styles.loadingRow}>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </div>
        ) : (
          <div className={styles.grid}>
            {regions.map((region) => (
              <button
                key={region.id}
                className={styles.card}
                onClick={() => handleSelect(region)}
                type="button"
              >
                <span className={styles.icon}>{REGION_ICONS[region.id] ?? '📍'}</span>
                <span className={styles.regionName}>{region.name}</span>
                <span className={styles.states}>
                  {region.states.slice(0, 5).join(' · ')}
                  {region.states.length > 5 ? ` +${region.states.length - 5}` : ''}
                </span>
                <span className={styles.count}>
                  {region.campground_count.toLocaleString()} campgrounds
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
