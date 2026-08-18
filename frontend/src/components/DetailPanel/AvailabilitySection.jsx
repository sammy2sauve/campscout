import styles from './DetailPanel.module.css'

export function AvailabilitySection({ rows, start, end, loading }) {
  if (!start || !end) {
    return (
      <p className={styles.empty}>
        Select a date range in the filter panel to check availability.
      </p>
    )
  }

  if (loading) return <p className={styles.empty}>Loading...</p>

  if (!rows.length) {
    return <p className={styles.empty}>No availability data for this window.</p>
  }

  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const available = counts['Available'] ?? 0
  const total = rows.length

  return (
    <div className={styles.availSummary}>
      <div className={styles.availCount}>
        <span className={available > 0 ? styles.availGood : styles.availNone}>
          {available}
        </span>
        <span className={styles.availLabel}> / {total} site-days available</span>
      </div>
      <div className={styles.availBreakdown}>
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className={styles.availRow}>
            <span>{status}</span>
            <span>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
