import styles from './DetailPanel.module.css'

const CATEGORY_COLORS = {
  Danger: 'var(--color-danger)',
  'Park Closure': 'var(--color-danger)',
  Caution: 'var(--color-caution)',
  Information: 'var(--color-info)',
}

export function AlertsSection({ alerts }) {
  if (!alerts.length) {
    return <p className={styles.empty}>No active alerts.</p>
  }

  return (
    <div className={styles.alertsList}>
      {alerts.map((a, i) => (
        <div key={i} className={styles.alertCard}>
          <div className={styles.alertHeader}>
            <span
              className={styles.alertBadge}
              style={{ background: CATEGORY_COLORS[a.category] ?? 'var(--color-info)' }}
            >
              {a.category}
            </span>
            {a.published_at && (
              <span className={styles.alertDate}>
                {new Date(a.published_at).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className={styles.alertTitle}>{a.title}</p>
          {a.description && <p className={styles.alertDesc}>{a.description}</p>}
        </div>
      ))}
    </div>
  )
}
