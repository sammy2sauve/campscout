import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useCampgroundDetail } from '../../hooks/useCampgroundDetail.js'
import { useWeather } from '../../hooks/useWeather.js'
import { useAlerts } from '../../hooks/useAlerts.js'
import { useAvailability } from '../../hooks/useAvailability.js'
import { TagPill } from '../shared/TagPill.jsx'
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx'
import { WeatherSection } from './WeatherSection.jsx'
import { AlertsSection } from './AlertsSection.jsx'
import { PhotoGallery } from './PhotoGallery.jsx'
import { AvailabilityModal } from './AvailabilityModal.jsx'
import { getWildlifeIcon, primaryWildlifeGroup } from '../../emblems/wildlifeEmblems.js'
import { getTerrainColor, getTerrainIcon } from '../../emblems/terrainColors.js'
import { getActivityIcon } from '../../emblems/activityEmblems.js'
import styles from './DetailPanel.module.css'

const AMENITY_LABELS = [
  { key: 'has_electricity', label: 'Electricity' },
  { key: 'has_showers', label: 'Showers' },
  { key: 'has_toilets', label: 'Flush Toilets' },
  { key: 'has_drinking_water', label: 'Drinking Water' },
  { key: 'pets_allowed', label: 'Dog Friendly' },
  { key: 'ada_accessible', label: 'ADA Accessible' },
]

/** Map NOAA short_forecast text → weather emoji */
function wxEmoji(forecast) {
  if (!forecast) return '🌤️'
  const f = forecast.toLowerCase()
  if (f.includes('thunder') || f.includes('storm')) return '⛈️'
  if (f.includes('snow') || f.includes('wintry') || f.includes('blizzard')) return '🌨️'
  if (f.includes('fog') || f.includes('hazy') || f.includes('smoke')) return '🌫️'
  if (f.includes('rain') || f.includes('shower') || f.includes('drizzle')) return '🌧️'
  if (f.includes('overcast') || f.includes('cloudy')) return '☁️'
  if (f.includes('mostly sunny') || f.includes('partly')) return '⛅'
  if (f.includes('sunny') || f.includes('clear')) return '☀️'
  if (f.includes('wind') || f.includes('breezy')) return '💨'
  return '🌤️'
}

/** Today + Tonight weather card with large emoji emblems */
function WeatherCard({ rows }) {
  const today = rows?.find(r => r.is_daytime) ?? null
  const tonight = rows?.find(r => !r.is_daytime) ?? null
  if (!today && !tonight) {
    return <p className={styles.empty}>No weather data.</p>
  }
  return (
    <div className={styles.wxCard}>
      {today && (
        <div className={styles.wxPeriod}>
          <span className={styles.wxEmoji} aria-hidden="true">{wxEmoji(today.short_forecast)}</span>
          <span className={styles.wxTemp}>{today.temperature_f}°F</span>
          <span className={styles.wxPeriodLabel}>Today</span>
          <span className={styles.wxDesc}>{today.short_forecast}</span>
          {today.precip_pct > 0 && (
            <span className={styles.wxPrecip}>{today.precip_pct}% rain</span>
          )}
        </div>
      )}
      {tonight && (
        <div className={styles.wxPeriod}>
          <span className={styles.wxEmoji} aria-hidden="true">{wxEmoji(tonight.short_forecast)}</span>
          <span className={styles.wxTemp}>{tonight.temperature_f}°F</span>
          <span className={styles.wxPeriodLabel}>Tonight</span>
          <span className={styles.wxDesc}>{tonight.short_forecast}</span>
        </div>
      )}
    </div>
  )
}

/** Small icon bubble: SVG inside a circle, tooltip label */
function IconBubble({ icon, label, dotColor }) {
  return (
    <span
      title={label}
      className={styles.iconBubble}
      style={dotColor ? { borderColor: dotColor, color: dotColor } : {}}
      aria-label={label}
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
    </span>
  )
}

/** Clickable availability pill that opens the modal */
function AvailPill({ data, loading, start, end, onClick }) {
  if (!start || !end) {
    return <p className={styles.empty}>Set dates in the filter panel to check availability.</p>
  }
  if (loading) return <p className={styles.empty}>Checking availability…</p>

  const count = data?.available_site_count ?? 0
  return (
    <button
      className={count > 0 ? styles.availPillGood : styles.availPillNone}
      onClick={count > 0 ? onClick : undefined}
      type="button"
      disabled={count === 0}
    >
      {count > 0 ? `${count} site${count !== 1 ? 's' : ''} available  →` : 'No sites available'}
    </button>
  )
}

export function DetailPanel() {
  const { selectedId, setSelectedId, filters } = useApp()
  const { detail, loading } = useCampgroundDetail(selectedId)
  const { rows: weatherRows } = useWeather(selectedId)
  const { alerts } = useAlerts(selectedId)
  const { data: availData, loading: availLoading } = useAvailability(
    selectedId,
    filters.availStart,
    filters.availEnd,
  )
  const [showAvailModal, setShowAvailModal] = useState(false)

  const descRef = useRef(null)
  const summaryRef = useRef(null)

  if (!selectedId) return null

  return (
    <aside className={styles.panel}>
      {/* ── Loading / error state ────────────────────────────────────────── */}
      {loading && !detail ? (
        <div className={styles.center}><LoadingSpinner size={28} /></div>
      ) : !detail ? (
        <div className={styles.center}><p>Failed to load.</p></div>
      ) : (
        <>
          {/* ── Sticky top: photo gallery + name bar ─────────────────────── */}
          <div className={styles.stickyTop}>
            <PhotoGallery urls={detail.photo_urls} />
            <div className={styles.nameBar}>
              <div className={styles.nameGroup}>
                <h2 className={styles.name}>{detail.name}</h2>
                {detail.state_code && (
                  <span className={styles.state}>{detail.state_code}</span>
                )}
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                type="button"
              >✕</button>
            </div>
          </div>

          {/* ── Scrollable body ───────────────────────────────────────────── */}
          <div className={styles.body}>

            {/* ══ SUMMARY SECTION ══════════════════════════════════════════ */}
            <div ref={summaryRef} className={styles.summarySection}>

              {/* Weather emblems */}
              <section>
                <h3 className={styles.sectionTitle}>Weather</h3>
                <WeatherCard rows={weatherRows} />
              </section>

              {/* Availability */}
              <section>
                <h3 className={styles.sectionTitle}>Availability</h3>
                <AvailPill
                  data={availData}
                  loading={availLoading}
                  start={filters.availStart}
                  end={filters.availEnd}
                  onClick={() => setShowAvailModal(true)}
                />
              </section>

              {/* Activities icon row */}
              {detail.activity_tags?.length > 0 && (() => {
                const icons = [...new Set(
                  detail.activity_tags.map(t => ({ icon: getActivityIcon(t), label: t }))
                    .filter(x => x.icon)
                    .map(JSON.stringify)
                )].map(JSON.parse)
                return icons.length > 0 ? (
                  <section>
                    <h3 className={styles.sectionTitle}>Activities</h3>
                    <div className={styles.bubbleRow}>
                      {icons.map(({ icon, label }) => (
                        <IconBubble key={label} icon={icon} label={label} />
                      ))}
                    </div>
                  </section>
                ) : null
              })()}

              {/* Landscape icon row */}
              {detail.terrain_tags?.length > 0 && (() => {
                const icons = [...new Set(
                  detail.terrain_tags.map(t => ({ icon: getTerrainIcon(t), label: t, dotColor: getTerrainColor(t) }))
                    .filter(x => x.icon)
                    .map(JSON.stringify)
                )].map(JSON.parse)
                const dots = detail.terrain_tags
                  .filter(t => !getTerrainIcon(t))
                  .map(t => ({ label: t, dotColor: getTerrainColor(t) }))
                return (icons.length > 0 || dots.length > 0) ? (
                  <section>
                    <h3 className={styles.sectionTitle}>Landscape</h3>
                    <div className={styles.bubbleRow}>
                      {icons.map(({ icon, label, dotColor }) => (
                        <IconBubble key={label} icon={icon} label={label} dotColor={dotColor} />
                      ))}
                      {dots.map(({ label, dotColor }) => (
                        <span
                          key={label}
                          title={label}
                          className={styles.dotBubble}
                          style={{ background: dotColor }}
                          aria-label={label}
                        />
                      ))}
                    </div>
                  </section>
                ) : null
              })()}

              {/* Wildlife icon row */}
              {detail.wildlife_tags?.length > 0 && (() => {
                const seen = new Set()
                const icons = detail.wildlife_tags
                  .map(t => {
                    const group = primaryWildlifeGroup([t])
                    const key = `${group}:${t}`
                    if (seen.has(key)) return null
                    seen.add(key)
                    return { icon: getWildlifeIcon(group), label: t }
                  })
                  .filter(Boolean)
                  .filter(x => x.icon)
                return icons.length > 0 ? (
                  <section>
                    <h3 className={styles.sectionTitle}>Wildlife</h3>
                    <div className={styles.bubbleRow}>
                      {icons.map(({ icon, label }) => (
                        <IconBubble key={label} icon={icon} label={label} />
                      ))}
                    </div>
                  </section>
                ) : null
              })()}

              {/* Amenities */}
              <section>
                <h3 className={styles.sectionTitle}>Amenities</h3>
                <div className={styles.amenityRow}>
                  {AMENITY_LABELS.map(({ key, label }) =>
                    detail[key] ? (
                      <span key={key} className={styles.amenityChip}>{label}</span>
                    ) : null
                  )}
                  {!AMENITY_LABELS.some(({ key }) => detail[key]) && (
                    <span className={styles.empty}>None listed</span>
                  )}
                </div>
              </section>

              {/* Reserve + stay limit */}
              {(detail.reservation_url || detail.stay_limit) && (
                <section>
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
                </section>
              )}

              {/* Jump to description */}
              <button
                className={styles.jumpBtn}
                onClick={() => descRef.current?.scrollIntoView({ behavior: 'smooth' })}
                type="button"
              >
                About this campground ↓
              </button>
            </div>

            {/* ══ DESCRIPTION SECTION ══════════════════════════════════════ */}
            <div ref={descRef} className={styles.detailSection}>
              <button
                className={styles.jumpBtn}
                onClick={() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' })}
                type="button"
              >
                ↑ Back to summary
              </button>

              {detail.description && (
                <section>
                  <h3 className={styles.sectionTitle}>About</h3>
                  <p className={styles.description}>{detail.description}</p>
                </section>
              )}

              <section>
                <h3 className={styles.sectionTitle}>7-Day Weather</h3>
                <WeatherSection rows={weatherRows} isStale={detail.weather_stale} />
              </section>

              <section>
                <h3 className={styles.sectionTitle}>Alerts</h3>
                <AlertsSection alerts={alerts} />
              </section>
            </div>

          </div>

          {/* ── Availability modal (portal to body) ──────────────────────── */}
          {showAvailModal && (
            <AvailabilityModal
              data={availData}
              detail={detail}
              onClose={() => setShowAvailModal(false)}
            />
          )}
        </>
      )}
    </aside>
  )
}
