import styles from './DetailPanel.module.css'

function groupByDate(rows) {
  const map = {}
  for (const row of rows) {
    if (!map[row.forecast_date]) map[row.forecast_date] = {}
    map[row.forecast_date][row.is_daytime ? 'day' : 'night'] = row
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

export function WeatherSection({ rows, isStale }) {
  if (!rows.length) {
    return <p className={styles.empty}>No weather data available.</p>
  }

  const grouped = groupByDate(rows)

  return (
    <div>
      {isStale && (
        <div className={styles.staleWarning}>
          Weather data may be outdated.
        </div>
      )}
      <div className={styles.weatherGrid}>
        {grouped.map(([date, { day, night }]) => (
          <div key={date} className={styles.weatherDay}>
            <div className={styles.weatherDate}>
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className={styles.weatherPeriods}>
              {day && (
                <div className={styles.weatherPeriod}>
                  <span className={styles.periodLabel}>Day</span>
                  <span className={styles.temp}>{day.temperature_f}°F</span>
                  {day.precip_pct != null && <span className={styles.precip}>{day.precip_pct}% precip</span>}
                  <span className={styles.forecast}>{day.short_forecast}</span>
                </div>
              )}
              {night && (
                <div className={`${styles.weatherPeriod} ${styles.night}`}>
                  <span className={styles.periodLabel}>Night</span>
                  <span className={styles.temp}>{night.temperature_f}°F</span>
                  {night.precip_pct != null && <span className={styles.precip}>{night.precip_pct}% precip</span>}
                  <span className={styles.forecast}>{night.short_forecast}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
