import styles from './TagPill.module.css'

export function TagPill({ label, active, onClick }) {
  return (
    <button
      className={`${styles.pill} ${active ? styles.active : ''}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}
