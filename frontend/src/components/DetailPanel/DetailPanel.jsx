import { useApp } from '../../context/AppContext.jsx'
import { useCampgroundDetail } from '../../hooks/useCampgroundDetail.js'
import { useWeather } from '../../hooks/useWeather.js'
import { useAlerts } from '../../hooks/useAlerts.js'
import { useAvailability } from '../../hooks/useAvailability.js'
import { TagPill } from '../shared/TagPill.jsx'
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx'
import { WeatherSection } from './WeatherSection.jsx'
import { AlertsSection } from './AlertsSection.jsx'
import { AvailabilitySection } from './AvailabilitySection.jsx'
import styles from './DetailPanel.module.css'

const AMENITY_LABELS = [
  { key: 'has_electricity', label: 'Electricity' },
  { key: 'has_showers', label: 'Showers' },
  { key: 'has_toilets', label: 'Flush Toilets' },
  { key: 'has_drinking_water', label: 'Drinking Water' },
  { key: 'pets_allowed', label: 'Dog Friendly' },
  { key: 'ada_accessible', label: 'ADA Accessible' },
]

export function DetailPanel() {
  const { selectedId, setSelectedId, filters } = useApp()
  const { detail, loading } = useCampgroundDetail(selectedId)
  const { rows: weatherRows } = useWeather(selectedId)
  const { alerts } = useAlerts(selectedId)
  const { rows: availRows, loading: availLoading } = useAvailability(
    selectedId,
    filters.availStart,
    filters.availEnd,
  )

  if (!selectedId) return null

  return (
    <aside className={styles.panel}>
      <div className={styles.topBar}>
        <button className={styles.closeBtn} onClick={() => setSelectedId(null)} aria-label="Close">
          ✕
        </button>
      </div>

      {loading && !detail ? (
        <div className={styles.center}><LoadingSpinner size={28} /></div>
      ) : !detail ? (
        <div className={styles.center}><p>Failed to load.</p></div>
      ) : (
        <div className={styles.body}>
          <div className={styles.heading}>
            <h2 className={styles.name}>{detail.name}</h2>
            <span className={styles.state}>{detail.state_code}</span>
          </div>

          {detail.stay_limit && (
            <p className={styles.meta}>Stay limit: {detail.stay_limit}</p>
          )}

          {detail.reservation_url && (
            <a
              href={detail.reservation_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.reserveLink}
            >
              Reserve on Recreation.gov →
            </a>
          )}

          <section>
            <h3 className={styles.sectionTitle}>Amenities</h3>
            <div className={styles.amenityRow}>
              {AMENITY_LABELS.map(({ key, label }) =>
                detail[key] ? (
                  <span key={key} className={styles.amenityChip}>{label}</span>
                ) : null
              )}
            </div>
          </section>

          {detail.wildlife_tags?.length > 0 && (
            <section>
              <h3 className={styles.sectionTitle}>Wildlife</h3>
              <div className={styles.tagRow}>
                {detail.wildlife_tags.map((t) => <TagPill key={t} label={t} />)}
              </div>
            </section>
          )}

          {detail.terrain_tags?.length > 0 && (
            <section>
              <h3 className={styles.sectionTitle}>Terrain & Features</h3>
              <div className={styles.tagRow}>
                {detail.terrain_tags.map((t) => <TagPill key={t} label={t} />)}
              </div>
            </section>
          )}

          {detail.description && (
            <section>
              <h3 className={styles.sectionTitle}>About</h3>
              <p className={styles.description}>{detail.description}</p>
            </section>
          )}

          <section>
            <h3 className={styles.sectionTitle}>Availability</h3>
            <AvailabilitySection
              rows={availRows}
              start={filters.availStart}
              end={filters.availEnd}
              loading={availLoading}
            />
          </section>

          <section>
            <h3 className={styles.sectionTitle}>7-Day Weather</h3>
            <WeatherSection rows={weatherRows} isStale={detail.weather_stale} />
          </section>

          <section>
            <h3 className={styles.sectionTitle}>Alerts</h3>
            <AlertsSection alerts={alerts} />
          </section>
        </div>
      )}
    </aside>
  )
}
