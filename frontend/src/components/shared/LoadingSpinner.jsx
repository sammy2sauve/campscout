import styles from './LoadingSpinner.module.css'

export function LoadingSpinner({ size = 20 }) {
  return (
    <div
      className={styles.spinner}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  )
}
