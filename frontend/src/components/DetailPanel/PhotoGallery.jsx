import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './PhotoGallery.module.css'

export function PhotoGallery({ urls }) {
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const stripRef = useRef(null)
  const indexRef = useRef(0)   // always current — used inside event handlers

  // Keep indexRef in sync
  useEffect(() => { indexRef.current = index }, [index])

  if (!urls?.length) return null

  function scrollToIndex(i) {
    const strip = stripRef.current
    if (!strip) return
    strip.scrollTo({ left: i * strip.clientWidth, behavior: 'smooth' })
  }

  function onStripScroll() {
    const strip = stripRef.current
    if (!strip) return
    const i = Math.round(strip.scrollLeft / strip.clientWidth)
    setIndex(i)
  }

  function openLightbox(i) {
    setIndex(i)
    indexRef.current = i
    setLightbox(true)
  }

  function closeLightbox() {
    setLightbox(false)
    requestAnimationFrame(() => scrollToIndex(indexRef.current))
  }

  const prev = useCallback(() => {
    setIndex(i => {
      const next = (i - 1 + urls.length) % urls.length
      indexRef.current = next
      return next
    })
  }, [urls.length])

  const next = useCallback(() => {
    setIndex(i => {
      const next = (i + 1) % urls.length
      indexRef.current = next
      return next
    })
  }, [urls.length])

  // Keyboard nav while lightbox is open — uses ref so no stale closures
  useEffect(() => {
    if (!lightbox) return
    function onKey(e) {
      if (e.key === 'ArrowLeft')  prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape')     setLightbox(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, prev, next])

  return (
    <>
      {/* Snap-scroll strip */}
      <div className={styles.stripWrap}>
        <div
          className={styles.strip}
          ref={stripRef}
          onScroll={onStripScroll}
          aria-label="Campground photos"
        >
          {urls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Photo ${i + 1} of ${urls.length}`}
              className={styles.photo}
              loading={i === 0 ? 'eager' : 'lazy'}
              onClick={() => openLightbox(i)}
            />
          ))}
        </div>

        {/* Hint badge */}
        <div className={styles.hint} aria-hidden="true">
          {urls.length > 1 ? `${index + 1} / ${urls.length}  ↔ tap` : '⤢ tap to enlarge'}
        </div>
      </div>

      {/* Lightbox rendered at document.body so it escapes panel stacking context */}
      {lightbox && createPortal(
        <div
          className={styles.overlay}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${index + 1} of ${urls.length}`}
        >
          <button
            className={styles.closeBtn}
            onClick={closeLightbox}
            aria-label="Close photo viewer"
            type="button"
          >✕</button>

          <img
            src={urls[index]}
            alt={`Photo ${index + 1} of ${urls.length}`}
            className={styles.lightboxImg}
            onClick={e => e.stopPropagation()}
          />

          {urls.length > 1 && (
            <>
              <button
                className={`${styles.navBtn} ${styles.navLeft}`}
                onClick={e => { e.stopPropagation(); prev() }}
                aria-label="Previous photo"
                type="button"
              >‹</button>
              <button
                className={`${styles.navBtn} ${styles.navRight}`}
                onClick={e => { e.stopPropagation(); next() }}
                aria-label="Next photo"
                type="button"
              >›</button>
              <div className={styles.lightboxCounter} aria-live="polite">
                {index + 1} / {urls.length}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
