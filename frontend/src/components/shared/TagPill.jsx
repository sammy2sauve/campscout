import styles from './TagPill.module.css'

/**
 * TagPill — filterable tag button.
 *
 * Props:
 *   label     — text label (always shown; color is never the sole indicator)
 *   active    — boolean, highlights when a filter is selected
 *   onClick   — click handler (optional; pill becomes non-interactive if absent)
 *   icon      — raw SVG string for wildlife emblem (optional)
 *   dotColor  — hex color for terrain dot (optional); rendered as colored circle + label
 */
export function TagPill({ label, active, onClick, icon, dotColor }) {
  const inner = (
    <>
      {icon && (
        <span
          className={styles.icon}
          dangerouslySetInnerHTML={{ __html: icon }}
          aria-hidden="true"
        />
      )}
      {dotColor && !icon && (
        <span
          className={styles.dot}
          style={{ background: dotColor }}
          aria-hidden="true"
        />
      )}
      {label}
    </>
  )

  if (!onClick) {
    return <span className={`${styles.pill} ${active ? styles.active : ''}`}>{inner}</span>
  }

  return (
    <button
      className={`${styles.pill} ${active ? styles.active : ''}`}
      onClick={onClick}
      type="button"
      aria-pressed={active ?? false}
    >
      {inner}
    </button>
  )
}
