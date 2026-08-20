import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useCampgroundDetail } from '../../hooks/useCampgroundDetail.js'
import { useWeather } from '../../hooks/useWeather.js'
import { useAlerts } from '../../hooks/useAlerts.js'
import { useAvailability } from '../../hooks/useAvailability.js'
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx'
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

/** Compact 7-day horizontal strip — one column per day, day+night stacked */
function WeatherWeek({ rows, isStale }) {
  if (!rows?.length) return <p className={styles.empty}>No weather data.</p>

  const grouped = {}
  for (const r of rows) {
    if (!grouped[r.forecast_date]) grouped[r.forecast_date] = {}
    grouped[r.forecast_date][r.is_daytime ? 'day' : 'night'] = r
  }
  const days = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 7)

  return (
    <div>
      {isStale && <div className={styles.staleWarning}>Weather may be outdated.</div>}
      <div className={styles.wxStrip}>
        {days.map(([date, { day, night }]) => {
          const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
          return (
            <div key={date} className={styles.wxCol}>
              <span className={styles.wxColDay}>{label}</span>
              <span className={styles.wxColEmoji} aria-hidden="true">{day ? wxEmoji(day.short_forecast) : '—'}</span>
              <span className={styles.wxColTemp}>{day ? `${day.temperature_f}°` : '—'}</span>
              <span className={styles.wxColDivider} aria-hidden="true" />
              <span className={styles.wxColNightEmoji} aria-hidden="true">{night ? wxEmoji(night.short_forecast) : '—'}</span>
              <span className={styles.wxColNightTemp}>{night ? `${night.temperature_f}°` : '—'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Compact alert rows for the summary — badge + title only */
const ALERT_COLORS = {
  Danger: 'var(--color-danger)',
  'Park Closure': 'var(--color-danger)',
  Caution: 'var(--color-caution)',
  Information: 'var(--color-info)',
}

function AlertsSummary({ alerts }) {
  if (!alerts?.length) return null
  return (
    <div className={styles.alertsCompact}>
      {alerts.slice(0, 3).map((a, i) => (
        <div key={i} className={styles.alertCompactRow}>
          <span
            className={styles.alertCompactBadge}
            style={{ background: ALERT_COLORS[a.category] ?? 'var(--color-info)' }}
          >
            {a.category ?? 'Alert'}
          </span>
          <span className={styles.alertCompactTitle}>{a.title}</span>
        </div>
      ))}
      {alerts.length > 3 && (
        <p className={styles.alertCompactMore}>+{alerts.length - 3} more</p>
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
  // No campsite records at all — walk-in / primitive / not yet ingested
  if (data?.no_data) {
    return (
      <div className={styles.fcfsBadge}>
        <span aria-hidden="true">📞</span>
        <span>
          <strong>Contact the Ranger Station</strong>
          <br />
          <small>No online reservation data — walk-in or call ahead for availability</small>
        </span>
      </div>
    )
  }

  // Campsites exist but availability hasn't been synced yet
  if (data?.syncing) {
    return (
      <div className={styles.fcfsBadge}>
        <span aria-hidden="true">⏳</span>
        <span>
          <strong>Availability syncing</strong>
          <br />
          <small>Data is being loaded — check back soon</small>
        </span>
      </div>
    )
  }

  // FCFS campground — campsites exist but are first-come-first-serve
  if (data?.fcfs_only) {
    return (
      <div className={styles.fcfsBadge}>
        <span aria-hidden="true">🥾</span>
        <span>
          <strong>First Come, First Serve</strong>
          <br />
          <small>No online reservations — contact the ranger station for availability</small>
        </span>
      </div>
    )
  }

  if (!start || !end) {
    return (
      <div className={styles.availPillEmpty}>
        <span aria-hidden="true">📅</span>
        Set dates to check availability
      </div>
    )
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

          {/* ── Scrollable body: scroll-snaps between summary and description ── */}
          <div className={styles.body}>

            {/* ══ SUMMARY SECTION — fills full body height, jump btn at bottom ══ */}
            {(() => {
              // Pre-compute icon lists so JSX stays clean
              const seenAct = new Set()
              const actIcons = (detail.activity_tags ?? [])
                .map(t => ({ icon: getActivityIcon(t), label: t }))
                .filter(({ icon }) => icon && !seenAct.has(icon) && seenAct.add(icon))

              const seenTer = new Set()
              const terIcons = (detail.terrain_tags ?? [])
                .map(t => ({ icon: getTerrainIcon(t), label: t, dotColor: getTerrainColor(t) }))
                .filter(({ icon }) => icon && !seenTer.has(icon) && seenTer.add(icon))
              const terDots = (detail.terrain_tags ?? [])
                .filter(t => !getTerrainIcon(t) && getTerrainColor(t))
                .map(t => ({ label: t, dotColor: getTerrainColor(t) }))

              const seenWild = new Set()
              const wildIcons = (detail.wildlife_tags ?? [])
                .map(t => {
                  const group = primaryWildlifeGroup([t])
                  const icon = getWildlifeIcon(group)
                  return { icon, label: t }
                })
                .filter(({ icon }) => icon && !seenWild.has(icon) && seenWild.add(icon))

              return (
                <div ref={summaryRef} className={styles.summarySection}>

                  {/* 7-day weather strip */}
                  <section>
                    <h3 className={styles.sectionTitle}>7-Day Weather</h3>
                    <WeatherWeek rows={weatherRows} isStale={detail.weather_stale} />
                  </section>

                  {/* Availability */}
                  <AvailPill
                    data={availData}
                    loading={availLoading}
                    start={filters.availStart}
                    end={filters.availEnd}
                    onClick={() => setShowAvailModal(true)}
                  />

                  {/* Activities */}
                  {actIcons.length > 0 && (
                    <section>
                      <h3 className={styles.sectionTitle}>Activities</h3>
                      <div className={styles.bubbleRow}>
                        {actIcons.map(({ icon, label }) => (
                          <IconBubble key={label} icon={icon} label={label} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Landscape */}
                  {(terIcons.length > 0 || terDots.length > 0) && (
                    <section>
                      <h3 className={styles.sectionTitle}>Landscape</h3>
                      <div className={styles.bubbleRow}>
                        {terIcons.map(({ icon, label, dotColor }) => (
                          <IconBubble key={label} icon={icon} label={label} dotColor={dotColor} />
                        ))}
                        {terDots.map(({ label, dotColor }) => (
                          <span key={label} title={label} className={styles.dotBubble} style={{ background: dotColor }} aria-label={label} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Wildlife */}
                  {wildIcons.length > 0 && (
                    <section>
                      <h3 className={styles.sectionTitle}>Wildlife</h3>
                      <div className={styles.bubbleRow}>
                        {wildIcons.map(({ icon, label }) => (
                          <IconBubble key={label} icon={icon} label={label} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Amenities */}
                  {AMENITY_LABELS.some(({ key }) => detail[key]) && (
                    <section>
                      <h3 className={styles.sectionTitle}>Amenities</h3>
                      <div className={styles.amenityRow}>
                        {AMENITY_LABELS.map(({ key, label }) =>
                          detail[key] ? <span key={key} className={styles.amenityChip}>{label}</span> : null
                        )}
                      </div>
                    </section>
                  )}

                  {/* Alerts */}
                  <AlertsSummary alerts={alerts} />

                  {/* Reserve + stay limit */}
                  {(detail.reservation_url || detail.stay_limit) && (
                    <div>
                      {detail.stay_limit && <p className={styles.meta}>Stay limit: {detail.stay_limit}</p>}
                      {detail.reservation_url && (
                        <a href={detail.reservation_url} target="_blank" rel="noopener noreferrer" className={styles.reserveLink}>
                          Reserve on Recreation.gov →
                        </a>
                      )}
                    </div>
                  )}

                  {/* Spacer pushes jump button to bottom of snap section */}
                  <div className={styles.snapSpacer} />

                  <button
                    className={styles.jumpBtn}
                    onClick={() => descRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    type="button"
                  >
                    About this campground ↓
                  </button>
                </div>
              )
            })()}

            {/* ══ DESCRIPTION SECTION ══════════════════════════════════════ */}
            <div ref={descRef} className={styles.detailSection}>
              <button
                className={styles.jumpBtn}
                onClick={() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' })}
                type="button"
              >
                ↑ Back to summary
              </button>

              {detail.description ? (
                <section>
                  <h3 className={styles.sectionTitle}>About</h3>
                  <p className={styles.description}>{detail.description}</p>
                </section>
              ) : (
                <p className={styles.empty}>No description available.</p>
              )}
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
