import styles from './FreshnessBadge.module.css'

function timeAgo(isoString) {
  const then = new Date(isoString)
  const diffMs = Date.now() - then.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return 'less than 1h ago'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function freshnessLevel(isoString) {
  const hours = (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60)
  if (hours < 12) return 'fresh'
  if (hours < 48) return 'aging'
  return 'stale'
}

export function FreshnessBadge({ dataAsOf }) {
  if (!dataAsOf) return null
  const level = freshnessLevel(dataAsOf)
  return (
    <div className={`${styles.badge} ${styles[level]}`} title={`Data updated: ${new Date(dataAsOf).toLocaleString()}`}>
      <span className={styles.dot} aria-hidden="true" />
      <span>Data as of {timeAgo(dataAsOf)}</span>
    </div>
  )
}
