import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import styles from './AvailabilityModal.module.css'

/** Format "2025-06-14" → "Jun 14" */
function fmtDate(str) {
  if (!str) return ''
  const d = new Date(str + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function AvailabilityModal({ data, detail, onClose }) {
  const sites = data?.sites?.filter(s => s.available_dates.length > 0) ?? []

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const dateRange = data?.start && data?.end
    ? `${fmtDate(data.start)} – ${fmtDate(data.end)}`
    : null

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Available campsites">
      <div className={styles.card} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>
              {data?.available_site_count ?? 0} Available{' '}
              {data?.available_site_count === 1 ? 'Site' : 'Sites'}
            </h3>
            {dateRange && <p className={styles.subtitle}>{dateRange}</p>}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close" type="button">✕</button>
        </div>

        <div className={styles.list}>
          {sites.length === 0 ? (
            <p className={styles.empty}>No sites available in this window.</p>
          ) : (
            sites.map(site => (
              <a
                key={site.rec_campsite_id}
                href={`https://www.recreation.gov/camping/campsites/${site.rec_campsite_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.siteRow}
              >
                <div className={styles.siteInfo}>
                  <span className={styles.siteName}>
                    {site.name || `Site ${site.rec_campsite_id}`}
                  </span>
                  <span className={styles.siteMeta}>
                    {[site.loop && `Loop: ${site.loop}`, site.site_type].filter(Boolean).join(' · ')}
                  </span>
                  <span className={styles.siteDates}>
                    {site.available_dates.slice(0, 4).map(fmtDate).join(', ')}
                    {site.available_dates.length > 4 && ` +${site.available_dates.length - 4} more`}
                  </span>
                </div>
                <div className={styles.siteRight}>
                  <span className={styles.availCount}>{site.available_dates.length}</span>
                  <span className={styles.availOf}>/{site.total_dates}</span>
                  <span className={styles.bookArrow}>→</span>
                </div>
              </a>
            ))
          )}
        </div>

        {detail?.reservation_url && (
          <div className={styles.footer}>
            <a
              href={detail.reservation_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.campLink}
            >
              View campground on Recreation.gov →
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
