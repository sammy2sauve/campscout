import { useEffect, useState } from 'react'
import { fetchRegions, fetchCampgrounds } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import styles from './HomePage.module.css'

const REGION_ICONS = {
  southeast:   '🌿',
  northeast:   '🍂',
  great_lakes: '🌊',
  plains:      '🌾',
  mountain:    '⛰️',
  pacific_west:'🌲',
}

// ── Photo gallery strip ────────────────────────────────────────────────────

function Gallery({ campgrounds }) {
  const { setSelectedRegion } = useApp()
  const withPhotos = campgrounds.filter((cg) => cg.photo_urls?.length > 0)
  if (withPhotos.length === 0) return null

  return (
    <section className={styles.gallerySection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Featured Campgrounds</h2>
        <p className={styles.sectionSub}>Real sites pulled from Recreation.gov</p>
      </div>
      <div className={styles.galleryStrip}>
        {withPhotos.slice(0, 12).map((cg) => (
          <button
            key={cg.id}
            className={styles.galleryCard}
            onClick={() => setSelectedRegion(cg.region_id)}
            type="button"
            title={`Explore ${cg.name}`}
          >
            <img
              src={cg.photo_urls[0]}
              alt={cg.name}
              className={styles.galleryImg}
              loading="lazy"
            />
            <div className={styles.galleryOverlay}>
              <span className={styles.galleryName}>{cg.name}</span>
              <span className={styles.galleryState}>{cg.state_code}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function HomePage() {
  const [regions, setRegions] = useState([])
  const [featured, setFeatured] = useState([])
  const { setSelectedRegion } = useApp()

  useEffect(() => {
    fetchRegions()
      .then(setRegions)
      .catch(() => {})

    // Grab SE campgrounds for the gallery — grows automatically as data fills in
    fetchCampgrounds({ region: 'southeast', limit: 20 })
      .then((data) => setFeatured(data.items ?? []))
      .catch(() => {})
  }, [])

  return (
    <div className={styles.page}>

      {/* ── Fixed nav ─────────────────────────────────────── */}
      <nav className={styles.nav}>
        <span className={styles.navLogo}>CampScout</span>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>Federal Campground Search</p>
          <h1 className={styles.heroTitle}>
            Find your perfect<br />campsite.
          </h1>
          <p className={styles.heroSub}>
            Live availability · Real-time weather · Park alerts
          </p>
          <a href="#explore" className={styles.heroCta}>
            Explore Campgrounds ↓
          </a>
        </div>
      </section>

      {/* ── Photo gallery (hidden until data arrives) ──────── */}
      <Gallery campgrounds={featured} />

      {/* ── About ─────────────────────────────────────────── */}
      <section className={styles.aboutSection}>
        <div className={styles.aboutInner}>
          <h2 className={styles.aboutTitle}>Built from real data.</h2>
          <p className={styles.aboutBody}>
            CampScout pulls live campsite availability from Recreation.gov,
            campground metadata and alerts from the National Park Service,
            and weather forecasts from NOAA — refreshed daily and served
            through an interactive, map-first search dashboard.
          </p>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>4,000+</span>
              <span className={styles.statLabel}>Federal campgrounds</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>90 days</span>
              <span className={styles.statLabel}>Availability window</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>3 live sources</span>
              <span className={styles.statLabel}>Rec.gov · NPS · NOAA</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Region picker ─────────────────────────────────── */}
      <section id="explore" className={styles.regionSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Start Exploring</h2>
          <p className={styles.sectionSub}>Choose a region to open the interactive map</p>
        </div>

        {regions.length === 0 ? (
          <div className={styles.loadingRow}>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </div>
        ) : (
          <div className={styles.regionGrid}>
            {regions.map((r) => (
              <button
                key={r.id}
                className={styles.regionCard}
                onClick={() => setSelectedRegion(r.id)}
                type="button"
              >
                <span className={styles.regionIcon}>{REGION_ICONS[r.id] ?? '📍'}</span>
                <span className={styles.regionName}>{r.name}</span>
                <span className={styles.regionStates}>
                  {r.states.slice(0, 5).join(' · ')}
                  {r.states.length > 5 ? ` +${r.states.length - 5}` : ''}
                </span>
                <span className={styles.regionCount}>
                  {r.campground_count.toLocaleString()} campgrounds
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <p>Data: Recreation.gov · National Park Service · NOAA · © OpenStreetMap contributors</p>
      </footer>

    </div>
  )
}
